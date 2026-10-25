'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PUSH_FLAG_KEY,
  isIos,
  isPushSupported,
  isStandalone,
  postSubscription,
  registerServiceWorker,
  safeStorageSet,
  sha256Hex,
  urlBase64ToUint8Array,
} from '@/components/admin/push-client';

export interface DeviceRow {
  id: string;
  label: string;
  endpointHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

type Env = {
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: NotificationPermission | 'unsupported';
  endpointHash: string | null; // this browser's current subscription, if any
};

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const card: React.CSSProperties = { border: '1px solid var(--line)', padding: 18, marginBottom: 20 };

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

async function readEnv(): Promise<Env> {
  const supported = isPushSupported();
  let endpointHash: string | null = null;
  if (supported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) endpointHash = await sha256Hex(sub.endpoint);
    } catch {
      // ignore — treated as "not subscribed"
    }
  }
  return {
    supported,
    ios: isIos(),
    standalone: isStandalone(),
    permission: supported ? Notification.permission : 'unsupported',
    endpointHash,
  };
}

export function PushNotificationSettings({
  serverConfigured,
  devices,
}: {
  serverConfigured: boolean;
  devices: DeviceRow[];
}) {
  const router = useRouter();
  const [env, setEnv] = useState<Env | null>(null);
  const [busy, setBusy] = useState<null | 'enable' | 'disable' | 'test' | string>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const refreshEnv = useCallback(async () => {
    setEnv(await readEnv());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readEnv().then((next) => {
      if (!cancelled) setEnv(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const thisDevice = env?.endpointHash ? devices.find((d) => d.endpointHash === env.endpointHash) : undefined;
  const enabledHere = Boolean(thisDevice);

  async function enable() {
    setNotice(null);
    setBusy('enable');
    try {
      // 1. Permission — requested ONLY here, straight from the button click.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotice({
          kind: 'error',
          text:
            permission === 'denied'
              ? 'Notifications are blocked for this site. Allow them in your browser/site settings, then try again.'
              : 'Permission was dismissed. Tap “Enable Order Notifications” again and choose Allow.',
        });
        return;
      }

      // 2. Service worker + the server's PUBLIC VAPID key.
      const reg = await registerServiceWorker();
      const cfgRes = await fetch('/api/admin/push/config', { cache: 'no-store' });
      if (cfgRes.status === 401) {
        setNotice({ kind: 'error', text: 'Your session expired. Please sign in again.' });
        return;
      }
      const cfg = (await cfgRes.json().catch(() => null)) as { configured?: boolean; publicKey?: string } | null;
      if (!cfg?.configured || !cfg.publicKey) {
        setNotice({
          kind: 'error',
          text: 'Push notifications are not configured on the server yet (VAPID keys missing). See the setup guide.',
        });
        return;
      }
      const applicationServerKey = urlBase64ToUint8Array(cfg.publicKey);

      // 3. Subscribe (replace a stale subscription made with different keys).
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        const current = sub.options.applicationServerKey;
        const same =
          current &&
          new Uint8Array(current).length === applicationServerKey.length &&
          new Uint8Array(current).every((b, i) => b === applicationServerKey[i]);
        if (!same) {
          await sub.unsubscribe();
          sub = null;
        }
      }
      sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));

      // 4. Register it with the server (admin-authenticated).
      const res = await postSubscription(sub);
      if (!res.ok) {
        await sub.unsubscribe().catch(() => undefined);
        const data = await res.json().catch(() => ({}));
        setNotice({ kind: 'error', text: data.error ?? 'Could not register this device. Please try again.' });
        return;
      }

      safeStorageSet(PUSH_FLAG_KEY, '1');
      setNotice({ kind: 'ok', text: 'Order notifications are enabled on this device. Send a test to confirm.' });
      router.refresh();
    } catch (err) {
      console.error(err);
      setNotice({
        kind: 'error',
        text: 'Could not enable notifications on this device. Make sure you are using HTTPS (or the installed app on iPhone) and try again.',
      });
    } finally {
      setBusy(null);
      await refreshEnv();
    }
  }

  async function disableHere() {
    setNotice(null);
    setBusy('disable');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      safeStorageSet(PUSH_FLAG_KEY, null);
      setNotice({ kind: 'ok', text: 'Order notifications are turned off on this device.' });
      router.refresh();
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', text: 'Could not turn notifications off. Please try again.' });
    } finally {
      setBusy(null);
      await refreshEnv();
    }
  }

  async function removeDevice(device: DeviceRow) {
    if (device.endpointHash === env?.endpointHash) return disableHere();
    setNotice(null);
    setBusy(device.id);
    try {
      const res = await fetch('/api/admin/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: device.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setNotice({
        kind: 'ok',
        text: `Removed “${device.label}”. If that device is still signed in as admin, use “Turn off” on it to stop it for good.`,
      });
      router.refresh();
    } catch {
      setNotice({ kind: 'error', text: 'Could not remove that device. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setNotice(null);
    setBusy('test');
    try {
      const res = await fetch('/api/admin/push/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: 'error', text: data.error ?? 'Could not send the test notification.' });
      } else {
        setNotice({
          kind: 'ok',
          text: `Test sent to ${data.sent} device${data.sent === 1 ? '' : 's'}. It should arrive within a few seconds.`,
        });
        router.refresh();
      }
    } catch {
      setNotice({ kind: 'error', text: 'Network error while sending the test notification.' });
    } finally {
      setBusy(null);
    }
  }

  const blockedByIos = env?.ios && !env.standalone;

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Order Notifications</h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 24 }}>
        Get a push notification on your phone the moment a customer places an order — even when the site is closed.
        Tapping it opens that exact order here in the dashboard.
      </p>

      {!serverConfigured && (
        <div role="alert" style={{ ...card, borderColor: 'var(--danger)', color: 'var(--danger)', fontSize: 14 }}>
          Push notifications are not set up on the server yet: <code>VAPID_PUBLIC_KEY</code>,{' '}
          <code>VAPID_PRIVATE_KEY</code> and <code>VAPID_SUBJECT</code> are missing. Run{' '}
          <code>npm run push:generate-keys</code>, add the three values to the server environment and redeploy.
        </div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          style={{
            ...card,
            padding: 12,
            fontSize: 14,
            borderColor: notice.kind === 'error' ? 'var(--danger)' : 'var(--success)',
            color: notice.kind === 'error' ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {notice.text}
        </div>
      )}

      <section style={card} aria-labelledby="push-this-device">
        <span className="eyebrow" id="push-this-device">
          This device
        </span>

        {!env ? (
          <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Checking this device…</p>
        ) : !env.supported ? (
          <p style={{ fontSize: 14, margin: '8px 0 0' }}>
            {blockedByIos ? (
              <>
                On iPhone and iPad, notifications only work from the app installed on your Home Screen — see “How to
                enable it on your phone” below.
              </>
            ) : (
              <>
                This browser can’t receive push notifications (they need a modern browser on HTTPS). Try Chrome on
                Android, or install the site to your Home Screen on iPhone (iOS 16.4+).
              </>
            )}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, margin: '8px 0 14px' }}>
              Status:{' '}
              <strong>
                {env.permission === 'denied'
                  ? 'Blocked in browser settings'
                  : enabledHere
                    ? 'Enabled'
                    : env.permission === 'granted'
                      ? 'Allowed, but not registered'
                      : 'Not enabled'}
              </strong>
            </p>

            {env.permission === 'denied' && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 14px' }}>
                You (or your browser) blocked notifications for this site. Open the site settings (the lock icon next
                to the address bar on Android, or Settings → Notifications on iPhone), set Notifications to Allow,
                then reload this page.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!enabledHere ? (
                <button
                  className="btn btn-primary"
                  onClick={enable}
                  disabled={busy !== null || !serverConfigured || env.permission === 'denied' || blockedByIos}
                >
                  {busy === 'enable' ? 'Enabling…' : 'Enable Order Notifications'}
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={sendTest} disabled={busy !== null}>
                    {busy === 'test' ? 'Sending…' : 'Send test notification'}
                  </button>
                  <button className="btn btn-outline" onClick={disableHere} disabled={busy !== null}>
                    {busy === 'disable' ? 'Turning off…' : 'Turn off on this device'}
                  </button>
                </>
              )}
            </div>

            {blockedByIos && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '14px 0 0' }}>
                You’re viewing this in Safari. Add the site to your Home Screen and open it from there to enable
                notifications (steps below).
              </p>
            )}
          </>
        )}
      </section>

      <section style={card} aria-labelledby="push-devices">
        <span className="eyebrow" id="push-devices">
          Devices receiving order notifications
        </span>
        {devices.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '8px 0 0' }}>No devices yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
            {devices.map((d) => (
              <li
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: '1px solid var(--line)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 14 }}>
                  <strong>{d.label}</strong>
                  {d.endpointHash === env?.endpointHash && (
                    <span className="badge badge-new" style={{ marginLeft: 8 }}>
                      This device
                    </span>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    Added {formatDate(d.createdAt)} · Last notified {formatDate(d.lastUsedAt)}
                  </div>
                </div>
                <button className="btn btn-outline" onClick={() => removeDevice(d)} disabled={busy !== null}>
                  {busy === d.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={card} aria-labelledby="push-howto">
        <span className="eyebrow" id="push-howto">
          How to enable it on your phone
        </span>
        <h3 style={{ fontSize: 15, margin: '12px 0 4px' }}>Android (Chrome or Edge)</h3>
        <ol style={{ fontSize: 14, margin: 0, paddingLeft: 20, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
          <li>Open this page on your phone and sign in as admin.</li>
          <li>Tap “Enable Order Notifications”, then Allow.</li>
          <li>Tap “Send test notification” to confirm. Optional: menu → “Install app” for a Home Screen icon.</li>
        </ol>
        <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>iPhone / iPad (iOS 16.4 or newer)</h3>
        <ol style={{ fontSize: 14, margin: 0, paddingLeft: 20, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
          <li>Open this page in <strong>Safari</strong> and sign in as admin.</li>
          <li>Tap Share → <strong>Add to Home Screen</strong> → Add.</li>
          <li>Open “MERRIER Admin” from your Home Screen (not Safari) and sign in again.</li>
          <li>Come back to this page, tap “Enable Order Notifications” and choose Allow.</li>
        </ol>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '14px 0 0' }}>
          Notifications carry only the order number and total. Tapping one always asks you to sign in first if your
          session has expired, and only admins can open order details.
        </p>
      </section>
    </div>
  );
}
