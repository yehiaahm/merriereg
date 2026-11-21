// Marketing attribution: the last paid-ad touch (UTM tags + Meta's fbclid)
// seen before checkout. Captured client-side by components/MetaPixel.tsx into
// a first-party cookie, read server-side by app/api/checkout and saved on the
// Order, so Admin → Orders shows exactly which ad (if any) an order came from.
//
// Shared by client and server — no Node or browser-only imports here.
//
// The cookie is set by the browser and therefore untrusted input: every value
// is re-validated and length-capped on read, never used as anything but a
// display/reporting string.

export const ATTRIBUTION_COOKIE = 'mr_attr';
export const ATTRIBUTION_MAX_AGE_DAYS = 30;

export const ATTRIBUTION_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;
type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];

export type Attribution = Partial<Record<AttributionParam, string>> & {
  // Unix milliseconds of the touch; used to build Meta's fbc value.
  ts?: number;
};

const MAX_LEN = 200;
// Ad names (utm_content={{ad.name}}) can contain Arabic, dashes or spaces, so
// any printable text is accepted except control characters and markup/quote
// characters. Values are only ever stored via Prisma (parameterised) and shown
// through React (escaped), never interpreted.
const SAFE = /^[^\u0000-\u001f\u007f<>"'`\\]+$/u;

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, MAX_LEN);
  return v && SAFE.test(v) ? v : undefined;
}

/** Picks the attribution params out of a URL query string. Returns null if none are present. */
export function attributionFromSearch(search: string): Attribution | null {
  const params = new URLSearchParams(search);
  const out: Attribution = {};
  let found = false;
  for (const key of ATTRIBUTION_PARAMS) {
    const v = clean(params.get(key));
    if (v) {
      out[key] = v;
      found = true;
    }
  }
  if (!found) return null;
  out.ts = Date.now();
  return out;
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(JSON.stringify(a));
}

/**
 * Parses and re-validates the cookie value. Never throws.
 *
 * Accepts both the raw cookie text and an already-decoded value: Next's
 * `req.cookies.get()` URL-decodes cookie values itself, so decoding a second
 * time would throw on any ad tag containing a literal "%" (e.g. "50%_off")
 * and silently drop the order's attribution.
 */
export function parseAttribution(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  try {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      data = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    }
    if (!data || typeof data !== 'object') return null;
    const out: Attribution = {};
    let found = false;
    for (const key of ATTRIBUTION_PARAMS) {
      const v = clean(data[key]);
      if (v) {
        out[key] = v;
        found = true;
      }
    }
    if (typeof data.ts === 'number' && Number.isFinite(data.ts) && data.ts > 0) out.ts = data.ts;
    return found ? out : null;
  } catch {
    return null;
  }
}

/** Meta's documented fbc format, built from an fbclid when the _fbc cookie is missing. */
export function fbcFromFbclid(fbclid: string, ts: number = Date.now()): string {
  return `fb.1.${ts}.${fbclid}`;
}

/** Validates the _fbp / _fbc cookies Meta's Pixel sets (format: fb.<n>.<ts>.<value>). */
export function cleanMetaCookie(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const v = value.trim().slice(0, MAX_LEN);
  return /^fb\.\d\.\d+\.[\w\-.]+$/.test(v) ? v : undefined;
}
