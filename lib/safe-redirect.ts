/**
 * Returns `next` only if it is a same-site relative path (e.g. "/admin/orders/abc"),
 * otherwise `fallback`. Used for the post-login redirect so a crafted
 * /account/login?next=https://evil.example (or //evil.example, /\evil.example)
 * link can never bounce a freshly signed-in user to another site.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/account'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (next.length > 2048) return fallback;
  // Must be a single-slash absolute path. "//host" is protocol-relative and
  // "/\host" is normalised to "//host" by browsers.
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // No control characters / backslashes anywhere (header- or parser-confusion tricks).
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  return next;
}
