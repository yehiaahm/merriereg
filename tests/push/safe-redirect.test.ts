// Unit tests for the post-login redirect sanitiser and the push endpoint
// allowlist — the two pure security checks behind the notification deep link
// and the subscribe API. No database needed.
// Run: npm run test:push
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from '../../lib/safe-redirect';
import { isAllowedPushEndpoint } from '../../lib/push/config';

describe('safeRedirectPath', () => {
  test('keeps same-site paths (the notification deep link)', () => {
    assert.equal(safeRedirectPath('/admin/orders/cmabc123xyz'), '/admin/orders/cmabc123xyz');
    assert.equal(safeRedirectPath('/admin/orders/abc?x=1#top'), '/admin/orders/abc?x=1#top');
  });

  test('falls back for missing values', () => {
    assert.equal(safeRedirectPath(null), '/account');
    assert.equal(safeRedirectPath(undefined), '/account');
    assert.equal(safeRedirectPath(''), '/account');
    assert.equal(safeRedirectPath('', '/admin'), '/admin');
  });

  test('rejects absolute and protocol-relative URLs (open redirect)', () => {
    for (const bad of [
      'https://evil.example',
      'http://evil.example/admin',
      '//evil.example',
      '///evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'admin/orders/1',
      '/admin\\..\\evil',
      '/admin/orders/1\r\nLocation: https://evil.example',
      '/admin/\u0000x',
    ]) {
      assert.equal(safeRedirectPath(bad), '/account', `should reject ${JSON.stringify(bad)}`);
    }
  });

  test('rejects absurdly long values', () => {
    assert.equal(safeRedirectPath('/' + 'a'.repeat(3000)), '/account');
  });
});

describe('isAllowedPushEndpoint', () => {
  test('accepts the real browser push services', () => {
    assert.ok(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
    assert.ok(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'));
    assert.ok(isAllowedPushEndpoint('https://web.push.apple.com/QAbc'));
    assert.ok(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc'));
  });

  test('rejects arbitrary hosts, plain http, lookalikes and credentials (SSRF guard)', () => {
    for (const bad of [
      'https://evil.example/push',
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilfcm.googleapis.com.example/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://127.0.0.1/x',
      'https://localhost/x',
      'not a url',
      '',
    ]) {
      assert.equal(isAllowedPushEndpoint(bad), false, `should reject ${bad}`);
    }
  });
});
