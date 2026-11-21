// Unit tests for ad attribution parsing and the Conversions API payload.
// No database or network needed.
// Run: npm run test:meta
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import {
  attributionFromSearch,
  cleanMetaCookie,
  fbcFromFbclid,
  parseAttribution,
  serializeAttribution,
} from '../../lib/meta/attribution';
import { buildPurchaseEvent, normalizeEgyptPhone, siteOrigin } from '../../lib/meta/capi';
import { isAdminPath } from '../../lib/meta/pixel-client';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

describe('attribution', () => {
  test('picks UTM tags and fbclid from a landing URL', () => {
    const a = attributionFromSearch('?utm_source=meta&utm_medium=paid_social&utm_campaign=winter_drop_nov26&utm_content=Ad A&fbclid=IwAR123&x=1');
    assert.ok(a);
    assert.equal(a.utm_source, 'meta');
    assert.equal(a.utm_content, 'Ad A');
    assert.equal(a.fbclid, 'IwAR123');
    assert.equal(typeof a.ts, 'number');
    assert.equal((a as Record<string, unknown>).x, undefined);
  });

  test('keeps Arabic / punctuated ad names from {{ad.name}}', () => {
    const a = attributionFromSearch('?utm_content=' + encodeURIComponent('A — الجملة اللي على ضهرك'));
    assert.equal(a?.utm_content, 'A — الجملة اللي على ضهرك');
  });

  test('returns null when the URL has no ad params (organic visit keeps the last touch)', () => {
    assert.equal(attributionFromSearch('?color=brown'), null);
  });

  test('round-trips through the cookie format', () => {
    const a = attributionFromSearch('?utm_source=meta&utm_campaign=c1')!;
    assert.deepEqual(parseAttribution(serializeAttribution(a)), a);
  });

  test('rejects tampered or oversized cookie values', () => {
    assert.equal(parseAttribution('not json'), null);
    assert.equal(parseAttribution(encodeURIComponent(JSON.stringify({ utm_source: '<script>' }))), null);
    const long = parseAttribution(encodeURIComponent(JSON.stringify({ utm_source: 'a'.repeat(500) })));
    assert.equal(long?.utm_source?.length, 200);
  });

  test('reads a cookie value that Next already URL-decoded, including a literal "%"', () => {
    const a = attributionFromSearch('?utm_source=meta&utm_content=' + encodeURIComponent('ad1_v2_post 50%_off'))!;
    // What document.cookie stores…
    const stored = serializeAttribution(a);
    assert.deepEqual(parseAttribution(stored), a);
    // …and what req.cookies.get() hands the checkout route (decoded once already).
    assert.deepEqual(parseAttribution(decodeURIComponent(stored)), a);
  });

  test('validates Meta browser cookies and builds fbc from fbclid', () => {
    assert.equal(cleanMetaCookie('fb.1.1700000000000.123456789'), 'fb.1.1700000000000.123456789');
    assert.equal(cleanMetaCookie('evil value'), undefined);
    assert.equal(fbcFromFbclid('IwAR123', 1700000000000), 'fb.1.1700000000000.IwAR123');
  });
});

describe('conversions api payload', () => {
  test('normalizes Egyptian phones to country-code digits', () => {
    assert.equal(normalizeEgyptPhone('01012345678'), '201012345678');
    assert.equal(normalizeEgyptPhone('+20 101 234 5678'), '201012345678');
    assert.equal(normalizeEgyptPhone('12345'), null);
  });

  test('builds a de-duplicable, hashed Purchase event in EGP', () => {
    const event = buildPurchaseEvent(
      {
        id: 'ord_1',
        orderNumber: 'MR261119-12345678',
        total: 96900,
        customerName: 'Omar Hassan',
        customerPhone: '01012345678',
        customerEmail: 'Omar@Example.com',
        shippingGovernorate: 'Cairo',
        items: [{ sku: 'MR-CREWNECK-V2-BRN-M', quantity: 1, unitPrice: 89900 }],
      },
      { clientIp: '41.0.0.1', userAgent: 'UA', fbp: 'fb.1.1.111', fbclid: 'IwAR9', fbclidTs: 5 },
      1_700_000_000_000
    );
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, 'ord_1');
    assert.equal(event.event_time, 1_700_000_000);
    assert.equal(event.custom_data.value, 969);
    assert.equal(event.custom_data.currency, 'EGP');
    assert.deepEqual(event.custom_data.content_ids, ['MR-CREWNECK-V2-BRN-M']);
    assert.deepEqual(event.user_data.ph, [sha('201012345678')]);
    assert.deepEqual(event.user_data.em, [sha('omar@example.com')]);
    assert.deepEqual(event.user_data.fn, [sha('omar')]);
    assert.deepEqual(event.user_data.ct, [sha('cairo')]);
    assert.equal(event.user_data.fbp, 'fb.1.1.111');
    assert.equal(event.user_data.fbc, 'fb.1.5.IwAR9');
    // Raw personal data must never appear in the payload.
    assert.ok(!JSON.stringify(event).includes('01012345678'));
    assert.ok(!JSON.stringify(event).toLowerCase().includes('omar@example.com'));
  });

  test('a webhook-style event (no IP) still carries the saved user agent and source URL', () => {
    const event = buildPurchaseEvent(
      {
        id: 'ord_2',
        orderNumber: 'MR261121-1',
        total: 10000,
        customerName: 'Mona',
        customerPhone: '01112345678',
        customerEmail: null,
        shippingGovernorate: 'Giza',
        items: [{ sku: 'SKU-1', quantity: 2, unitPrice: 5000 }],
      },
      { userAgent: 'Mozilla/5.0 Saved', fbc: 'fb.1.2.IwAR7', eventSourceUrl: 'https://shop.example/checkout' }
    );
    assert.equal(event.user_data.client_user_agent, 'Mozilla/5.0 Saved');
    assert.equal(event.user_data.client_ip_address, undefined);
    assert.equal(event.user_data.fbc, 'fb.1.2.IwAR7');
    assert.equal(event.user_data.ln, undefined);
    assert.equal(event.event_source_url, 'https://shop.example/checkout');
    assert.equal(event.custom_data.num_items, 2);
  });
});

describe('admin guard', () => {
  test('treats /admin and its sub-pages as admin, nothing else', () => {
    assert.equal(isAdminPath('/admin'), true);
    assert.equal(isAdminPath('/admin/orders/abc'), true);
    assert.equal(isAdminPath('/'), false);
    assert.equal(isAdminPath('/administrator-hoodie'), false);
    assert.equal(isAdminPath('/product/admin'), false);
  });
});

describe('siteOrigin', () => {
  test('prefers NEXT_PUBLIC_SITE_URL, else the request host, and rejects junk hosts', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    try {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example/';
      assert.equal(siteOrigin(new Headers({ host: 'other.example' })), 'https://shop.example');
      delete process.env.NEXT_PUBLIC_SITE_URL;
      assert.equal(siteOrigin(new Headers({ host: 'merriereg-production.up.railway.app' })), 'https://merriereg-production.up.railway.app');
      assert.equal(siteOrigin(new Headers({ host: 'evil"/><x' })), undefined);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
