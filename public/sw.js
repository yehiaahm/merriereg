/* MERRIER admin push service worker.
 *
 * Only handles push notifications — it deliberately does no caching and no
 * fetch interception, so it can never serve stale or another user's pages.
 * It holds no secrets: the push payload carries just a title, short text and
 * a same-origin path. Tapping a notification only *navigates*; the server
 * still checks the admin session before showing any order data.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** Accepts only same-origin paths; anything else falls back to the admin orders list. */
function safeTarget(raw) {
  try {
    const url = new URL(typeof raw === 'string' ? raw : '/admin/orders', self.location.origin);
    if (url.origin !== self.location.origin) return new URL('/admin/orders', self.location.origin).href;
    return url.href;
  } catch (e) {
    return new URL('/admin/orders', self.location.origin).href;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'MERRIER';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/push/icon-192.png',
    badge: '/push/badge-96.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: safeTarget(data.url) },
  };

  // Every push must show a notification (required by browsers, and by iOS in particular).
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        let clientUrl;
        try {
          clientUrl = new URL(client.url);
        } catch (e) {
          continue;
        }
        if (clientUrl.origin !== self.location.origin) continue;
        // Don't navigate a POS terminal away mid-sale; open a separate window instead.
        if (clientUrl.pathname.startsWith('/admin/pos')) continue;
        try {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(target);
            return;
          }
        } catch (e) {
          // fall through to opening a new window
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

// The browser rotated/expired our subscription: re-subscribe and re-register
// with the server (best effort — the admin pages also re-sync on next visit).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription;
        const key = old && old.options && old.options.applicationServerKey;
        if (!key) return;
        const sub =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        await fetch('/api/admin/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
          credentials: 'same-origin',
        });
      } catch (e) {
        // ignored — see comment above
      }
    })()
  );
});
