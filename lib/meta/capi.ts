import { createHash } from 'crypto';
import { piastresToEgp } from '@/lib/money';
import { cleanMetaCookie, fbcFromFbclid } from '@/lib/meta/attribution';

// Meta Conversions API (server-side events). Sends the same Purchase the
// browser Pixel sends from the order page, with the same event_id (the order
// id), and the same InitiateCheckout the checkout page sends (event_id made
// on the server per page render), so Meta counts each once but still receives
// it when an ad blocker or a closed tab stops the browser event.
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
  // Piastres. The event value is the products after discount, without
  // shipping (subtotal − discount), so ROAS in Ads Manager measures product
  // revenue — shipping is passed through to the courier, not earned.
  subtotal: number;
  discount: number;
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

/** Products after discount, excluding shipping, in EGP — the value both the Pixel and CAPI report. */
export function purchaseValueEgp(order: { subtotal: number; discount: number }): number {
  return piastresToEgp(Math.max(0, order.subtotal - order.discount));
}

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
      value: purchaseValueEgp(order),
      order_id: order.orderNumber,
      content_type: 'product',
      content_ids: order.items.map((i) => i.sku),
      contents: order.items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: piastresToEgp(i.unitPrice) })),
      num_items: order.items.reduce((n, i) => n + i.quantity, 0),
    },
  };
}

type CheckoutItem = { sku: string; quantity: number; unitPrice: number };

/**
 * InitiateCheckout for the Conversions API. `eventId` is generated once on the
 * server when the checkout page renders and handed to the browser Pixel too,
 * so Meta keeps one of the two. Only browser identifiers are sent (plus the
 * signed-in customer's email/phone, hashed, when there is one) — a guest has
 * typed nothing yet at this point.
 */
export function buildInitiateCheckoutEvent(
  checkout: {
    eventId: string;
    items: CheckoutItem[];
    subtotal: number; // piastres
    customerEmail?: string | null;
    customerPhone?: string | null;
  },
  ctx: MetaRequestContext,
  eventTimeMs: number = Date.now()
) {
  const phone = checkout.customerPhone ? normalizeEgyptPhone(checkout.customerPhone) : null;
  const fbc = cleanMetaCookie(ctx.fbc) ?? (ctx.fbclid ? fbcFromFbclid(ctx.fbclid, ctx.fbclidTs) : undefined);
  const fbp = cleanMetaCookie(ctx.fbp);
  const ip = ctx.clientIp && ctx.clientIp !== 'unknown' ? ctx.clientIp : undefined;

  return {
    event_name: 'InitiateCheckout',
    event_time: Math.floor(eventTimeMs / 1000),
    event_id: checkout.eventId,
    action_source: 'website',
    ...(ctx.eventSourceUrl ? { event_source_url: ctx.eventSourceUrl } : {}),
    user_data: {
      country: [sha256('eg')],
      ...(phone ? { ph: [sha256(phone)], external_id: [sha256(phone)] } : {}),
      ...(checkout.customerEmail ? { em: [sha256(checkout.customerEmail.trim().toLowerCase())] } : {}),
      ...(ip ? { client_ip_address: ip } : {}),
      ...(ctx.userAgent ? { client_user_agent: ctx.userAgent.slice(0, 500) } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    },
    custom_data: {
      currency: 'EGP',
      value: piastresToEgp(checkout.subtotal),
      content_type: 'product',
      content_ids: checkout.items.map((i) => i.sku),
      contents: checkout.items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: piastresToEgp(i.unitPrice) })),
      num_items: checkout.items.reduce((n, i) => n + i.quantity, 0),
    },
  };
}

/** Posts events to the Conversions API. Never throws; logs Meta's error text only. */
async function postMetaEvents(events: object[], label: string): Promise<void> {
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
        data: events,
        access_token: token,
        ...(testCode ? { test_event_code: testCode } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Log Meta's error message only — never the request body (it holds hashed PII and the token).
      const text = await res.text().catch(() => '');
      console.error(`[meta-capi] ${label} rejected: ${res.status} ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[meta-capi] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

/** Sends a Purchase to the Conversions API. Never throws. */
export async function sendMetaPurchase(order: PurchaseOrder, ctx: MetaRequestContext): Promise<void> {
  if (!isMetaCapiConfigured()) return;
  await postMetaEvents([buildPurchaseEvent(order, ctx)], `Purchase for ${order.orderNumber}`);
}

/** Sends an InitiateCheckout to the Conversions API. Never throws. */
export async function sendMetaInitiateCheckout(
  checkout: Parameters<typeof buildInitiateCheckoutEvent>[0],
  ctx: MetaRequestContext
): Promise<void> {
  if (!isMetaCapiConfigured()) return;
  await postMetaEvents([buildInitiateCheckoutEvent(checkout, ctx)], 'InitiateCheckout');
}
