import { NextRequest } from 'next/server';

/**
 * Per-instance, in-memory fixed-window rate limiter (login/signup/tracking...).
 *
 * State lives in this process's memory, so with more than one instance each
 * enforces its own independent limit. Acceptable for a single small store
 * (Railway's default is one instance); move to Redis/Postgres if scaled out.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 50_000;

/**
 * Best-effort client IP. `X-Forwarded-For` is a list that each proxy APPENDS
 * to, so the *first* entry is whatever the client chose to send and must never
 * be trusted. We take the entry added by our own trusted proxy: counting from
 * the right, skipping `TRUSTED_PROXY_HOPS - 1` additional proxies (default 1 =
 * a single edge proxy such as Railway's). Set TRUSTED_PROXY_HOPS to match the
 * real topology; with 0 the header is ignored entirely.
 */
export function clientIp(req: NextRequest): string {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10);
  if (!Number.isFinite(hops) || hops <= 0) return 'unknown';
  const parts = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'unknown';
  return parts[Math.max(0, parts.length - hops)] ?? 'unknown';
}

function makeRoom(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  // Still full: evict the oldest entries rather than wiping everyone's counters.
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/** Counts one hit for `key:id`; returns false once over `limit` within the window. */
export function rateLimitKey(key: string, id: string, limit: number, windowMs: number): boolean {
  const bucketKey = `${key}:${id}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    makeRoom(now);
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

export function rateLimit(req: NextRequest, key: string, limit: number, windowMs: number): boolean {
  return rateLimitKey(key, clientIp(req), limit, windowMs);
}

// --- Failure counters (e.g. failed logins per account) -----------------------
// Only failures count, and a success clears the counter, so a legitimate user is
// not locked out by their own successful logins.
export function isBlocked(key: string, id: string, limit: number): boolean {
  const b = buckets.get(`${key}:${id}`);
  return !!b && b.resetAt > Date.now() && b.count >= limit;
}

export function recordFailure(key: string, id: string, windowMs: number): void {
  const bucketKey = `${key}:${id}`;
  const now = Date.now();
  const b = buckets.get(bucketKey);
  if (!b || b.resetAt <= now) {
    makeRoom(now);
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
  } else {
    b.count++;
  }
}

export function clearFailures(key: string, id: string): void {
  buckets.delete(`${key}:${id}`);
}
