import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  CUSTOMER_COOKIE_NAME,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
  sessionTtlMs,
} from '@/lib/customer-session-token';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, 'hex');
  const derivedBuffer = scryptSync(password, salt, 64);
  return hashBuffer.length === derivedBuffer.length && timingSafeEqual(hashBuffer, derivedBuffer);
}

export async function setCustomerSessionCookie(customerId: string, isAdmin: boolean): Promise<void> {
  const store = await cookies();
  store.set(CUSTOMER_COOKIE_NAME, await createCustomerSessionToken(customerId, isAdmin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlMs(isAdmin) / 1000,
  });
}

export async function clearCustomerSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE_NAME);
}

export async function getCurrentCustomer() {
  const store = await cookies();
  const claims = await verifyCustomerSessionToken(store.get(CUSTOMER_COOKIE_NAME)?.value);
  if (!claims) return null;
  // Always read isAdmin fresh from the database rather than trusting the
  // token's claim here — this runs on the Node runtime (unlike proxy.ts's
  // Edge check), so a revoked admin loses access immediately everywhere
  // except the coarse Edge gate, which only stays stale for its 12h TTL.
  return prisma.customer.findUnique({ where: { id: claims.customerId } });
}

// NOTE: there is intentionally no "link past guest orders by email/phone"
// helper. Email and phone are not verified at signup, so linking on them would
// let an attacker register with someone else's details and read their orders.
// If this is ever re-added it must require a verified email (one-time link/code).

export { CUSTOMER_COOKIE_NAME };
