// Edge-runtime-safe session token logic (uses only Web Crypto, no Node
// built-ins) — this is the single sign-in system for both regular customers
// and admins (an admin is just a Customer row with isAdmin: true). Node-only
// customer auth helpers (password hashing, cookie setters using next/headers)
// live in lib/customer-auth.ts instead.

export const CUSTOMER_COOKIE_NAME = 'merrier_customer_session';
const CUSTOMER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
// Admin sessions carry more privilege, so they expire sooner — matches the
// previous single-shared-password admin cookie's lifetime.
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) {
    throw new Error('CUSTOMER_SESSION_SECRET is not set');
  }
  return secret;
}

function base64urlEncode(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64url');
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(payload: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64urlEncode(signature);
}

export function sessionTtlMs(isAdmin: boolean): number {
  return isAdmin ? ADMIN_SESSION_TTL_MS : CUSTOMER_SESSION_TTL_MS;
}

/**
 * Builds a signed, stateless session token: base64url(payload).signature
 * Payload carries the customer id (`sub`), whether they're an admin (`admin`,
 * checked by proxy.ts on the Edge runtime where hitting the database isn't
 * an option), and an expiry. The signature is what makes the cookie
 * un-forgeable without CUSTOMER_SESSION_SECRET.
 */
export async function createCustomerSessionToken(customerId: string, isAdmin: boolean): Promise<string> {
  const payload = JSON.stringify({ sub: customerId, admin: isAdmin, exp: Date.now() + sessionTtlMs(isAdmin) });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export interface CustomerSessionClaims {
  customerId: string;
  isAdmin: boolean;
}

/** Returns the claims encoded in the token, or null if missing/invalid/expired. */
export async function verifyCustomerSessionToken(token: string | undefined | null): Promise<CustomerSessionClaims | null> {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  try {
    const key = await getHmacKey();
    const signatureBytes = Buffer.from(signature, 'base64url');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(encodedPayload)
    );
    if (!valid) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null;
    if (typeof payload.sub !== 'string') return null;
    return { customerId: payload.sub, isAdmin: payload.admin === true };
  } catch {
    return null;
  }
}
