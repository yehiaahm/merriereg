import { NextRequest } from 'next/server';

/**
 * Per-instance, in-memory fixed-window rate limiter for public auth
 * endpoints (login/signup) — the only brute-force/abuse targets that don't
 * already have a natural cost (checkout/POS write real rows; the Paymob
 * webhook is gated by HMAC, not by request volume).
 *
 * This is intentionally NOT a distributed limiter: state lives in this
 * process's memory, so if Railway ever scales this service to more than one
 * instance, each instance enforces its own independent limit rather than a
 * shared one. That's an acceptable, documented gap for a single small store
 * (Railway's default is one instance) — replacing it with a shared limiter
 * would mean adding Redis (or similar) purely for this, which isn't
 * justified yet. Revisit if the service is ever scaled horizontally.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

// Bound memory: without this, an attacker rotating IPs (or just the map
// growing over a long-lived process) would accumulate entries forever.
const MAX_BUCKETS = 50_000;

export function rateLimit(req: NextRequest, key: string, limit: number, windowMs: number): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  const bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
