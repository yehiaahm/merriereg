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
import { buildInitiateCheckoutEvent, buildPurchaseEvent, normalizeEgyptPhone, siteOrigin } from '../../lib/meta/capi';
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
        // 899 product − 0 discount; the order total (969) includes 70 shipping.
        subtotal: 89900,
        discount: 0,
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
    assert.equal(event.custom_data.value, 899);
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
        subtotal: 10000,
        discount: 0,
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

describe('conversions api value and InitiateCheckout', () => {
  test('Purchase value is products after discount, excluding shipping', () => {
    const event = buildPurchaseEvent(
      {
        id: 'ord_3',
        orderNumber: 'MR1',
        subtotal: 149800,
        discount: 14980,
        customerName: 'A',
        customerPhone: '01012345678',
        customerEmail: null,
        shippingGovernorate: 'Cairo',
        items: [{ sku: 'S1', quantity: 2, unitPrice: 74900 }],
      },
      {}
    );
    assert.equal(event.custom_data.value, 1348.2);
  });

  test('InitiateCheckout carries the shared event id, cart value and only browser ids for guests', () => {
    const event = buildInitiateCheckoutEvent(
      { eventId: 'ic_abc', items: [{ sku: 'MR-CREWNECK-WHT-M', quantity: 1, unitPrice: 74900 }], subtotal: 74900 },
      { clientIp: '41.0.0.2', userAgent: 'UA', fbp: 'fb.1.1.222', fbc: 'not-valid' },
      1_700_000_000_000
    );
    assert.equal(event.event_name, 'InitiateCheckout');
    assert.equal(event.event_id, 'ic_abc');
    assert.equal(event.custom_data.value, 749);
    assert.equal(event.custom_data.num_items, 1);
    assert.equal(event.user_data.fbp, 'fb.1.1.222');
    assert.equal(event.user_data.fbc, undefined);
    assert.equal((event.user_data as Record<string, unknown>).ph, undefined);
  });

  test('InitiateCheckout hashes a signed-in customer phone', () => {
    const event = buildInitiateCheckoutEvent(
      { eventId: 'ic_2', items: [], subtotal: 0, customerPhone: '01012345678', customerEmail: 'A@B.com' },
      {}
    );
    assert.deepEqual((event.user_data as Record<string, unknown>).ph, [sha('201012345678')]);
    assert.deepEqual((event.user_data as Record<string, unknown>).em, [sha('a@b.com')]);
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
  test('prefers a real NEXT_PUBLIC_SITE_URL, then Railway domain, then request host', () => {
    const prev = { site: process.env.NEXT_PUBLIC_SITE_URL, rw: process.env.RAILWAY_PUBLIC_DOMAIN };
    try {
      delete process.env.RAILWAY_PUBLIC_DOMAIN;
      process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example/';
      assert.equal(siteOrigin(new Headers({ host: 'other.example' })), 'https://shop.example');
      // A leftover local value (what production has today) is ignored.
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
      process.env.RAILWAY_PUBLIC_DOMAIN = 'merriereg-production.up.railway.app';
      assert.equal(siteOrigin(new Headers({ host: 'localhost:8080' })), 'https://merriereg-production.up.railway.app');
      delete process.env.RAILWAY_PUBLIC_DOMAIN;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      assert.equal(siteOrigin(new Headers({ host: 'shop.example' })), 'https://shop.example');
      assert.equal(siteOrigin(new Headers({ host: 'localhost:3000' })), undefined);
      assert.equal(siteOrigin(new Headers({ host: 'evil"/><x' })), undefined);
    } finally {
      for (const [k, v] of [['NEXT_PUBLIC_SITE_URL', prev.site], ['RAILWAY_PUBLIC_DOMAIN', prev.rw]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
