'use client';

import { useEffect } from 'react';
import {
  PUSH_FLAG_KEY,
  isPushSupported,
  postSubscription,
  registerServiceWorker,
  safeStorageGet,
} from '@/components/admin/push-client';

/**
 * Keeps this browser's push subscription registered with the server while the
 * admin is using the dashboard (browsers occasionally rotate subscriptions).
 * Renders nothing, never prompts for permission, and only acts if the admin
 * previously enabled notifications on this device AND the browser permission
 * is still granted.
 */
export function AdminPushSync() {
  useEffect(() => {
    if (!isPushSupported()) return;
    if (safeStorageGet(PUSH_FLAG_KEY) !== '1') return;
    if (Notification.permission !== 'granted') return;

    let cancelled = false;
    (async () => {
      try {
        const reg = await registerServiceWorker();
        const sub = await reg.pushManager.getSubscription();
        if (!sub || cancelled) return;
        // Idempotent upsert on the server; throttled to once per tab session.
        if (window.sessionStorage.getItem('merrier_push_synced') === sub.endpoint) return;
        const res = await postSubscription(sub);
        if (res.ok) window.sessionStorage.setItem('merrier_push_synced', sub.endpoint);
      } catch {
        // background best-effort; the notifications page shows real status
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
