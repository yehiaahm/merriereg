// Runs public/sw.js in a sandbox with a mocked service-worker global to check
// what happens on a push and on a notification tap: the notification content,
// same-origin-only navigation, and the "site already open / closed / POS open"
// cases. (Real browsers are needed to test actual OS notification delivery.)
// Run: npm run test:push
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ORIGIN = 'https://shop.example';
const source = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

type Handler = (event: any) => void;

function load(windowClients: { url: string; focus?: () => Promise<void>; navigate?: (u: string) => Promise<void> }[] = []) {
  const handlers: Record<string, Handler> = {};
  const shown: { title: string; options: any }[] = [];
  const opened: string[] = [];
  const self: any = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: () => undefined,
    registration: { showNotification: async (title: string, options: any) => void shown.push({ title, options }) },
    clients: {
      claim: async () => undefined,
      matchAll: async () => windowClients,
      openWindow: async (u: string) => void opened.push(u),
    },
  };
  vm.runInNewContext(source, { self, URL, Date, fetch: async () => ({}), console });
  return { handlers, shown, opened };
}

function pushEvent(data: unknown) {
  const waits: Promise<unknown>[] = [];
  return {
    event: { data: { json: () => data, text: () => String(data) }, waitUntil: (p: Promise<unknown>) => waits.push(p) },
    done: () => Promise.all(waits),
  };
}

function clickEvent(url: unknown) {
  const waits: Promise<unknown>[] = [];
  let closed = false;
  return {
    event: { notification: { data: { url }, close: () => (closed = true) }, waitUntil: (p: Promise<unknown>) => waits.push(p) },
    done: () => Promise.all(waits),
    wasClosed: () => closed,
  };
}

describe('push event', () => {
  test('shows the notification with title, body, brand icons and a per-order tag', async () => {
    const sw = load();
    const p = pushEvent({ title: 'New Order Received!', body: 'Order #MR1 · Total: EGP 2,500', url: '/admin/orders/abc', tag: 'order-abc' });
    sw.handlers.push(p.event);
    await p.done();
    assert.equal(sw.shown.length, 1);
    assert.equal(sw.shown[0].title, 'New Order Received!');
    assert.equal(sw.shown[0].options.body, 'Order #MR1 · Total: EGP 2,500');
    assert.equal(sw.shown[0].options.tag, 'order-abc');
    assert.equal(sw.shown[0].options.icon, '/push/icon-192.png');
    assert.equal(sw.shown[0].options.badge, '/push/badge-96.png');
    assert.equal(sw.shown[0].options.data.url, `${ORIGIN}/admin/orders/abc`);
  });

  test('always shows something, even for an empty or malformed push (required by iOS/Chrome)', async () => {
    const sw = load();
    const bad = { data: { json: () => { throw new Error('not json'); }, text: () => 'hello' }, waitUntil: (_: unknown) => undefined };
    const waits: Promise<unknown>[] = [];
    sw.handlers.push({ ...bad, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    assert.equal(sw.shown.length, 1);
    assert.equal(sw.shown[0].title, 'MERRIER');
    assert.equal(sw.shown[0].options.body, 'hello');
  });

  test('a push pointing at another site is neutralised to the admin orders list', async () => {
    const sw = load();
    const p = pushEvent({ title: 't', body: 'b', url: 'https://evil.example/phish' });
    sw.handlers.push(p.event);
    await p.done();
    assert.equal(sw.shown[0].options.data.url, `${ORIGIN}/admin/orders`);
  });
});

describe('notificationclick', () => {
  test('site closed: opens the exact order in a new window', async () => {
    const sw = load([]);
    const c = clickEvent(`${ORIGIN}/admin/orders/abc`);
    sw.handlers.notificationclick(c.event);
    await c.done();
    assert.ok(c.wasClosed());
    assert.deepEqual(sw.opened, [`${ORIGIN}/admin/orders/abc`]);
  });

  test('site already open: focuses that window and navigates it to the order', async () => {
    const calls: string[] = [];
    const sw = load([{ url: `${ORIGIN}/admin/analytics`, focus: async () => void calls.push('focus'), navigate: async (u) => void calls.push(`navigate ${u}`) }]);
    const c = clickEvent(`${ORIGIN}/admin/orders/abc`);
    sw.handlers.notificationclick(c.event);
    await c.done();
    assert.deepEqual(calls, ['focus', `navigate ${ORIGIN}/admin/orders/abc`]);
    assert.deepEqual(sw.opened, []);
  });

  test('POS terminal open: is NOT navigated away mid-sale; a separate window opens instead', async () => {
    const calls: string[] = [];
    const sw = load([{ url: `${ORIGIN}/admin/pos`, focus: async () => void calls.push('focus'), navigate: async () => void calls.push('navigate') }]);
    const c = clickEvent(`${ORIGIN}/admin/orders/abc`);
    sw.handlers.notificationclick(c.event);
    await c.done();
    assert.deepEqual(calls, []);
    assert.deepEqual(sw.opened, [`${ORIGIN}/admin/orders/abc`]);
  });

  test('a window whose navigate() fails falls back to opening a new one', async () => {
    const sw = load([{ url: `${ORIGIN}/admin`, focus: async () => undefined, navigate: async () => { throw new Error('uncontrolled client'); } }]);
    const c = clickEvent(`${ORIGIN}/admin/orders/abc`);
    sw.handlers.notificationclick(c.event);
    await c.done();
    assert.deepEqual(sw.opened, [`${ORIGIN}/admin/orders/abc`]);
  });

  test('a tampered notification URL can never open another origin', async () => {
    const sw = load([]);
    for (const evil of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', 42, undefined]) {
      const c = clickEvent(evil);
      sw.handlers.notificationclick(c.event);
      await c.done();
    }
    assert.ok(sw.opened.length === 5);
    for (const u of sw.opened) assert.ok(u.startsWith(`${ORIGIN}/`), `opened ${u}`);
  });
});
