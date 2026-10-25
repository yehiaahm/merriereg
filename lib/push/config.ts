import webpush from 'web-push';

/**
 * Web Push (VAPID) configuration. All three values live only in server
 * environment variables — the private key never leaves the server, and the
 * public key is handed to the browser by an admin-only endpoint
 * (/api/admin/push/config), not baked into the client bundle.
 *
 * Generate a key pair with `npm run push:generate-keys`.
 */
export function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  // Push services require the subject to be a mailto: or https: URL.
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

let appliedKey: string | null = null;

/** Applies the VAPID details to the web-push library (idempotent). Throws if unconfigured. */
export function ensureVapidConfigured(): void {
  const cfg = getVapidConfig();
  if (!cfg) throw new Error('Web Push is not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).');
  const fingerprint = `${cfg.subject}|${cfg.publicKey}|${cfg.privateKey}`;
  if (appliedKey === fingerprint) return;
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  appliedKey = fingerprint;
}

/**
 * Push services we accept subscriptions from. The server POSTs to whatever
 * endpoint is registered, so accepting arbitrary URLs would turn the
 * subscribe API into a server-side request forgery primitive.
 */
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com', // Chrome / Edge / Android browsers, Samsung Internet
  'updates.push.services.mozilla.com', // Firefox
  'push.services.mozilla.com',
  'notify.windows.com', // legacy Edge / WNS
  'push.apple.com', // Safari / iOS & iPadOS Home Screen web apps
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
