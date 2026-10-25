// Integration tests for admin new-order push notifications against the REAL
// database (npm run db:local): who gets notified, when, how often, and what
// happens when delivery fails. A mock sender stands in for the push service in
// most tests; the last describe block sends real, encrypted Web Push messages
// (VAPID-signed, RFC 8291) to a local fake push service and decrypts them.
//
// Creates its own temporary fixtures (tagged customers/orders/subscriptions)
// and removes them afterwards. Run: npm run test:push
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createECDH, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import webpush from 'web-push';
import { prisma } from '../../lib/prisma';
import { buildNewOrderPayload, notifyAdminsOfNewOrder } from '../../lib/push/notify-order';
import { deliverToTarget, type PushSender } from '../../lib/push/send';

const require = createRequire(import.meta.url);
const tag = `pushtest-${Date.now()}`;
const FAST = [0, 0];

const ids = { customers: [] as string[], orders: [] as string[] };
const ep = (name: string) => `https://fcm.googleapis.com/fcm/send/${tag}-${name}`;
const KEYS = { p256dh: 'BP'.padEnd(87, 'x'), auth: 'a'.repeat(22) };

async function makeCustomer(name: string, isAdmin: boolean) {
  const c = await prisma.customer.create({
    data: { name: `${tag} ${name}`, email: `${tag}-${name}@example.test`, passwordHash: 'x:y', isAdmin },
  });
  ids.customers.push(c.id);
  return c;
}

async function makeSub(customerId: string, name: string) {
  return prisma.pushSubscription.create({
    data: { customerId, endpoint: ep(name), p256dh: KEYS.p256dh, auth: KEYS.auth, userAgent: 'test' },
  });
}

let orderSeq = 0;
async function makeOrder(opts: { paymentMethod?: 'COD' | 'PAYMOB_CARD' | 'POS_CASH'; paymentStatus?: 'PENDING' | 'PAID'; total?: number } = {}) {
  const o = await prisma.order.create({
    data: {
      orderNumber: `${tag}-${++orderSeq}`,
      customerName: 'Secret Customer Name',
      customerPhone: '01000000000',
      shippingGovernorate: 'Cairo',
      shippingCity: 'Cairo',
      subtotal: opts.total ?? 250000,
      shippingCost: 0,
      total: opts.total ?? 250000,
      paymentMethod: opts.paymentMethod ?? 'COD',
      paymentStatus: opts.paymentStatus ?? 'PENDING',
    },
  });
  ids.orders.push(o.id);
  return o;
}

/** Mock push service: records calls to OUR fixture endpoints, with per-endpoint behaviour. */
function mockSender(behaviour: Record<string, number | 'network'> = {}) {
  const calls: { endpoint: string; body: ReturnType<typeof JSON.parse> }[] = [];
  const sender: PushSender = async (target, body) => {
    if (!target.endpoint.includes(tag)) return { statusCode: 201 }; // not ours: never touch
    calls.push({ endpoint: target.endpoint, body: JSON.parse(body) });
    const b = behaviour[target.endpoint.replace(`https://fcm.googleapis.com/fcm/send/${tag}-`, '')];
    if (b === 'network') throw new Error('socket hang up');
    if (typeof b === 'number' && b >= 400) throw Object.assign(new Error(`HTTP ${b}`), { statusCode: b });
    return { statusCode: typeof b === 'number' ? b : 201 };
  };
  return { sender, calls, endpointsCalled: () => calls.map((c) => c.endpoint.split(`${tag}-`)[1]).sort() };
}

/** openssl is only needed to mint a throwaway TLS cert for the fake push service. */
function findOpenssl(): string {
  const candidates = [
    process.env.OPENSSL_BIN,
    'openssl',
    'C:/Program Files/Git/mingw64/bin/openssl.exe',
    'C:/Program Files/Git/usr/bin/openssl.exe',
    '/usr/bin/openssl',
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      execFileSync(c, ['version'], { stdio: 'ignore' });
      return c;
    } catch {
      // try the next one
    }
  }
  throw new Error('openssl not found');
}

let adminA: { id: string };
let adminB: { id: string };
let plain: { id: string };
let savedEnv: Record<string, string | undefined>;

before(async () => {
  savedEnv = {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  };
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@example.test';

  adminA = await makeCustomer('adminA', true);
  adminB = await makeCustomer('adminB', true);
  plain = await makeCustomer('plain', false);
  await makeSub(adminA.id, 'a-phone');
  await makeSub(adminA.id, 'a-laptop');
  await makeSub(adminB.id, 'b-phone');
  await makeSub(plain.id, 'customer-phone'); // an ordinary customer who somehow has a subscription
});

after(async () => {
  await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } }); // cascades subscriptions
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await prisma.$disconnect();
});

describe('payload', () => {
  test('uses the real order number and total, and no customer details', async () => {
    const order = await makeOrder({ total: 250000 }); // 2,500 EGP in piastres
    const p = buildNewOrderPayload(order);
    assert.equal(p.title, 'New Order Received!');
    assert.match(p.body, /A new customer order has been placed\./);
    assert.ok(p.body.includes(`Order #${order.orderNumber}`));
    assert.match(p.body, /Total: EGP\s?2,500/);
    assert.equal(p.url, `/admin/orders/${order.id}`);
    assert.equal(p.tag, `order-${order.id}`);
    const all = JSON.stringify(p);
    assert.ok(!all.includes('Secret Customer Name') && !all.includes('01000000000'), 'no PII in the payload');
  });

  test('formats non-round totals from the order, not hard-coded values', async () => {
    const order = await makeOrder({ total: 123456 });
    assert.match(buildNewOrderPayload(order).body, /Total: EGP\s?1,234\.56/);
  });
});

describe('who is notified', () => {
  test('every admin device gets exactly one push; ordinary customers get none', async () => {
    const order = await makeOrder();
    const m = mockSender();
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'sent');
    assert.deepEqual(m.endpointsCalled(), ['a-laptop', 'a-phone', 'b-phone']);
    assert.ok(!m.endpointsCalled().includes('customer-phone'));
    for (const c of m.calls) {
      assert.equal(c.body.url, `/admin/orders/${order.id}`);
      assert.ok(c.body.body.includes(order.orderNumber));
    }
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    assert.ok(fresh?.adminNotifiedAt, 'order is marked as notified');
  });

  test('a demoted admin stops receiving notifications immediately', async () => {
    const demoted = await makeCustomer('demoted', true);
    await makeSub(demoted.id, 'demoted-phone');
    await prisma.customer.update({ where: { id: demoted.id }, data: { isAdmin: false } });
    const order = await makeOrder();
    const m = mockSender();
    await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST });
    assert.ok(!m.endpointsCalled().includes('demoted-phone'));
  });
});

describe('when it triggers', () => {
  test('duplicate and concurrent triggers send one notification per device', async () => {
    const order = await makeOrder();
    const m = mockSender();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }))
    );
    assert.equal(outcomes.filter((o) => o === 'sent').length, 1);
    assert.equal(outcomes.filter((o) => o === 'duplicate').length, 5);
    assert.deepEqual(m.endpointsCalled(), ['a-laptop', 'a-phone', 'b-phone']);
    // a later redelivery is also a no-op
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'duplicate');
    assert.equal(m.calls.length, 3);
  });

  test('online-card order is not announced until payment is verified; webhook redelivery does not repeat it', async () => {
    const order = await makeOrder({ paymentMethod: 'PAYMOB_CARD', paymentStatus: 'PENDING' });
    const m = mockSender();
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'not-eligible');
    assert.equal(m.calls.length, 0);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } }))?.adminNotifiedAt, null);

    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'sent');
    assert.equal(m.calls.length, 3);
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'duplicate');
    assert.equal(m.calls.length, 3);
  });

  test('POS (in-store) sales are not announced as customer orders', async () => {
    const order = await makeOrder({ paymentMethod: 'POS_CASH', paymentStatus: 'PAID' });
    const m = mockSender();
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'not-eligible');
    assert.equal(m.calls.length, 0);
  });

  test('unknown order ids are ignored', async () => {
    assert.equal(await notifyAdminsOfNewOrder('does-not-exist', { backoffMs: FAST }), 'not-found');
  });

  test('does nothing (and never throws) when VAPID keys are not configured', async () => {
    const saved = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      const order = await makeOrder();
      assert.equal(await notifyAdminsOfNewOrder(order.id), 'not-configured');
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } }))?.adminNotifiedAt, null);
    } finally {
      process.env.VAPID_PRIVATE_KEY = saved;
    }
  });
});

describe('failures never break the order', () => {
  test('push service outage: no throw, order untouched, claim released, retry succeeds later', async () => {
    const order = await makeOrder();
    const down = mockSender({ 'a-phone': 503, 'a-laptop': 'network', 'b-phone': 429 });
    const result = await notifyAdminsOfNewOrder(order.id, { sender: down.sender, backoffMs: FAST });
    assert.equal(result, 'delivery-failed');
    // 3 attempts per device (bounded retries)
    assert.equal(down.calls.length, 9);

    const afterFail = await prisma.order.findUnique({ where: { id: order.id } });
    assert.ok(afterFail, 'the order itself is preserved');
    assert.equal(afterFail.adminNotifiedAt, null, 'claim released so a later trigger can retry');
    const failed = await prisma.pushSubscription.findUnique({ where: { endpoint: ep('a-phone') } });
    assert.equal(failed?.failureCount, 1);

    const up = mockSender();
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: up.sender, backoffMs: FAST }), 'sent');
    assert.equal(up.calls.length, 3);
    const healed = await prisma.pushSubscription.findUnique({ where: { endpoint: ep('a-phone') } });
    assert.equal(healed?.failureCount, 0);
    assert.ok(healed?.lastUsedAt);
  });

  test('one dead device does not stop the others, and the order still counts as notified', async () => {
    const order = await makeOrder();
    const m = mockSender({ 'b-phone': 500 });
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'sent');
    assert.ok((await prisma.order.findUnique({ where: { id: order.id } }))?.adminNotifiedAt);
  });

  test('a throwing sender or permanent rejection is swallowed, not retried forever', async () => {
    const order = await makeOrder();
    const rejected = mockSender({ 'a-phone': 400, 'a-laptop': 400, 'b-phone': 400 });
    const r = await notifyAdminsOfNewOrder(order.id, { sender: rejected.sender, backoffMs: FAST });
    assert.notEqual(r, 'duplicate');
    assert.equal(rejected.calls.length, 3, '4xx is permanent: one attempt per device, no retries');
  });
});

describe('subscription expiry', () => {
  test('410/404 from the push service removes that subscription only', async () => {
    const goneUser = await makeCustomer('goneAdmin', true);
    await makeSub(goneUser.id, 'gone-410');
    await makeSub(goneUser.id, 'gone-404');
    const order = await makeOrder();
    const m = mockSender({ 'gone-410': 410, 'gone-404': 404 });
    assert.equal(await notifyAdminsOfNewOrder(order.id, { sender: m.sender, backoffMs: FAST }), 'sent');
    assert.equal(m.calls.filter((c) => c.endpoint.endsWith('gone-410')).length, 1, 'no retry on gone');
    assert.equal(await prisma.pushSubscription.count({ where: { customerId: goneUser.id } }), 0);
    // healthy devices are intact
    assert.equal(await prisma.pushSubscription.count({ where: { customerId: adminA.id } }), 2);
  });

  test('deliverToTarget classifies outcomes', async () => {
    const t = { endpoint: ep('x'), p256dh: KEYS.p256dh, auth: KEYS.auth };
    const p = { title: 't', body: 'b', url: '/admin', tag: 'x' };
    const ok = await deliverToTarget(t, p, async () => ({ statusCode: 201 }), FAST);
    assert.deepEqual([ok.outcome, ok.attempts], ['sent', 1]);
    let n = 0;
    const flaky = await deliverToTarget(t, p, async () => {
      if (++n < 3) throw Object.assign(new Error('boom'), { statusCode: 502 });
      return { statusCode: 201 };
    }, FAST);
    assert.deepEqual([flaky.outcome, flaky.attempts], ['sent', 3]);
    const gone = await deliverToTarget(t, p, async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); }, FAST);
    assert.equal(gone.outcome, 'gone');
  });
});

// ---------------------------------------------------------------------------
// Real Web Push: VAPID signing + aes128gcm encryption, received and decrypted
// by a local fake push service (so no real device or Google/Apple service is
// contacted). Skipped if openssl is unavailable for the throwaway TLS cert.
// ---------------------------------------------------------------------------
describe('real encrypted Web Push round trip', () => {
  let server: https.Server;
  let dir: string;
  let port = 0;
  let prevTls: string | undefined;
  const received: { path: string; headers: IncomingHttpHeaders; body: Buffer }[] = [];
  const e2eDemoted: string[] = [];
  let skip: string | false = false;

  before(async () => {
    try {
      dir = mkdtempSync(join(tmpdir(), 'pushtest-'));
      execFileSync(findOpenssl(), ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
        '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], {
        stdio: 'ignore',
        // Some machines export an OPENSSL_CONF pointing at a missing file (e.g. PostgreSQL's ODBC installer).
        env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'OPENSSL_CONF')) as NodeJS.ProcessEnv,
      });
    } catch {
      skip = 'openssl not available';
      return;
    }

    // Safety: this block uses the real sender, so it must never reach a real device.
    const foreign = await prisma.pushSubscription.count({
      where: { customer: { isAdmin: true }, NOT: { customerId: { in: ids.customers } } },
    });
    if (foreign > 0) {
      skip = 'real admin push subscriptions exist in this database; refusing to send real pushes';
      return;
    }

    server = https.createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        received.push({ path: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks) });
        res.statusCode = req.url?.includes('/gone') ? 410 : 201;
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // self-signed test cert

    // Take the mock-endpoint admins out of the picture for this block.
    for (const c of [adminA, adminB]) {
      await prisma.customer.update({ where: { id: c.id }, data: { isAdmin: false } });
      e2eDemoted.push(c.id);
    }
  });

  after(async () => {
    for (const id of e2eDemoted) await prisma.customer.update({ where: { id }, data: { isAdmin: true } }).catch(() => undefined);
    if (server) await new Promise((r) => server.close(r));
    if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('sends a VAPID-signed, encrypted message the device can decrypt, and prunes a gone endpoint', async (t) => {
    if (skip) return t.skip(skip);

    const ece = require('http_ece') as { decrypt: (buf: Buffer, params: Record<string, unknown>) => Buffer };
    const admin = await makeCustomer('e2eAdmin', true);
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const authSecret = randomBytes(16);
    await prisma.pushSubscription.create({
      data: {
        customerId: admin.id,
        endpoint: `https://localhost:${port}/ok/${tag}`,
        p256dh: ecdh.getPublicKey().toString('base64url'),
        auth: authSecret.toString('base64url'),
      },
    });
    await prisma.pushSubscription.create({
      data: {
        customerId: admin.id,
        endpoint: `https://localhost:${port}/gone/${tag}`,
        p256dh: ecdh.getPublicKey().toString('base64url'),
        auth: authSecret.toString('base64url'),
      },
    });

    const order = await makeOrder({ total: 250000 });
    const result = await notifyAdminsOfNewOrder(order.id, { backoffMs: FAST }); // real sender
    assert.equal(result, 'sent');

    const ok = received.find((r) => r.path.startsWith('/ok/'));
    assert.ok(ok, 'push service received the message');
    assert.equal(ok.headers['content-encoding'], 'aes128gcm');
    assert.equal(ok.headers.urgency, 'high');
    assert.ok(Number(ok.headers.ttl) > 0);
    const auth = String(ok.headers.authorization);
    assert.match(auth, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    assert.ok(auth.endsWith(process.env.VAPID_PUBLIC_KEY!), 'signed for our public key');

    const plain = JSON.parse(ece.decrypt(ok.body, { version: 'aes128gcm', privateKey: ecdh, authSecret }).toString('utf8'));
    assert.deepEqual(plain, buildNewOrderPayload(order));
    assert.equal(plain.url, `/admin/orders/${order.id}`);

    // the 410 endpoint was pruned, the good one kept
    const left = await prisma.pushSubscription.findMany({ where: { customerId: admin.id } });
    assert.equal(left.length, 1);
    assert.ok(left[0].endpoint.includes('/ok/'));
  });
});
