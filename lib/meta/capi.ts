import { createHash } from 'crypto';
import { piastresToEgp } from '@/lib/money';
import { cleanMetaCookie, fbcFromFbclid } from '@/lib/meta/attribution';

// Meta Conversions API (server-side events). Sends the same Purchase the
// browser Pixel sends from the order page, with the same event_id (the order
// id), so Meta counts it once but still receives it when an ad blocker or a
// closed tab stops the browser event.
//
// Disabled (every call is a no-op) unless BOTH are set on the server:
//   META_PIXEL_ID            — same ID as NEXT_PUBLIC_META_PIXEL_ID
//   META_CAPI_ACCESS_TOKEN   — Events Manager → Settings → Conversions API → Generate access token
// Optional:
//   META_TEST_EVENT_CODE     — shows events under Events Manager → Test events while verifying
//   META_GRAPH_API_VERSION   — defaults to DEFAULT_GRAPH_VERSION below
//
// Personal data is SHA-256 hashed before it leaves the server, as Meta requires.
// Every call swallows its own errors: tracking must never break or slow checkout
// (callers run it inside next/server's after()).

const DEFAULT_GRAPH_VERSION = 'v24.0';

export function isMetaCapiConfigured(): boolean {
  return Boolean(process.env.META_PIXEL_ID?.trim() && process.env.META_CAPI_ACCESS_TOKEN?.trim());
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const HOST_RE = /^[a-z0-9.-]+(:\d+)?$/i;
const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);

/**
 * The store's public origin, for event_source_url (Meta requires it on website
 * events). In order: NEXT_PUBLIC_SITE_URL (ignored if it still points at
 * localhost, as a copied .env often does), Railway's public domain, then the
 * host the request came in on (Railway's edge only routes our own domains
 * here). Only ever sent to Meta as a reporting string.
 */
export function siteOrigin(headers: Headers): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configured) {
    try {
      if (!isLocalHost(new URL(configured).host)) return configured;
    } catch {
      // Not a valid URL — fall through.
    }
  }
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway && HOST_RE.test(railway)) return `https://${railway}`;
  const host = (headers.get('x-forwarded-host') ?? headers.get('host'))?.split(',')[0]?.trim();
  return host && HOST_RE.test(host) && !isLocalHost(host) ? `https://${host}` : undefined;
}

/** 010xxxxxxxx (the format lib/validation.ts stores) → 2010xxxxxxxx, digits only. */
export function normalizeEgyptPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (/^01\d{9}$/.test(digits)) return `2${digits}`;
  if (/^201\d{9}$/.test(digits)) return digits;
  return null;
}

type PurchaseOrder = {
  id: string;
  orderNumber: string;
  total: number; // piastres
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingGovernorate: string;
  items: { sku: string; quantity: number; unitPrice: number }[];
};

export type MetaRequestContext = {
  clientIp?: string;
  userAgent?: string;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  fbclidTs?: number;
  eventSourceUrl?: string;
};

export function buildPurchaseEvent(order: PurchaseOrder, ctx: MetaRequestContext, eventTimeMs: number = Date.now()) {
  const phone = normalizeEgyptPhone(order.customerPhone);
  const [firstName, ...rest] = order.customerName.trim().toLowerCase().split(/\s+/);
  const lastName = rest.join(' ');
  const city = order.shippingGovernorate.toLowerCase().replace(/[^a-z]/g, '');

  const fbc = cleanMetaCookie(ctx.fbc) ?? (ctx.fbclid ? fbcFromFbclid(ctx.fbclid, ctx.fbclidTs) : undefined);
  const fbp = cleanMetaCookie(ctx.fbp);
  const ip = ctx.clientIp && ctx.clientIp !== 'unknown' ? ctx.clientIp : undefined;

  const userData: Record<string, unknown> = {
    country: [sha256('eg')],
    ...(phone ? { ph: [sha256(phone)], external_id: [sha256(phone)] } : {}),
    ...(order.customerEmail ? { em: [sha256(order.customerEmail.trim().toLowerCase())] } : {}),
    ...(firstName ? { fn: [sha256(firstName)] } : {}),
    ...(lastName ? { ln: [sha256(lastName)] } : {}),
    ...(city ? { ct: [sha256(city)] } : {}),
    ...(ip ? { client_ip_address: ip } : {}),
    ...(ctx.userAgent ? { client_user_agent: ctx.userAgent.slice(0, 500) } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  };

  return {
    event_name: 'Purchase',
    event_time: Math.floor(eventTimeMs / 1000),
    // Same id the browser Pixel uses on the order page → Meta de-duplicates.
    event_id: order.id,
    action_source: 'website',
    ...(ctx.eventSourceUrl ? { event_source_url: ctx.eventSourceUrl } : {}),
    user_data: userData,
    custom_data: {
      currency: 'EGP',
      value: piastresToEgp(order.total),
      order_id: order.orderNumber,
      content_type: 'product',
      content_ids: order.items.map((i) => i.sku),
      contents: order.items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: piastresToEgp(i.unitPrice) })),
      num_items: order.items.reduce((n, i) => n + i.quantity, 0),
    },
  };
}

/** Sends a Purchase to the Conversions API. Never throws. */
export async function sendMetaPurchase(order: PurchaseOrder, ctx: MetaRequestContext): Promise<void> {
  if (!isMetaCapiConfigured()) return;
  const pixelId = process.env.META_PIXEL_ID!.trim();
  const token = process.env.META_CAPI_ACCESS_TOKEN!.trim();
  const version = process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
  const testCode = process.env.META_TEST_EVENT_CODE?.trim();

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(pixelId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [buildPurchaseEvent(order, ctx)],
        access_token: token,
        ...(testCode ? { test_event_code: testCode } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Log Meta's error message only — never the request body (it holds hashed PII and the token).
      const text = await res.text().catch(() => '');
      console.error(`[meta-capi] Purchase for ${order.orderNumber} rejected: ${res.status} ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[meta-capi] Purchase for ${order.orderNumber} failed:`, err instanceof Error ? err.message : err);
  }
}
