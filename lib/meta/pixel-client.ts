'use client';

// Thin, safe wrapper around Meta's browser Pixel (fbq). Every call is a no-op
// when NEXT_PUBLIC_META_PIXEL_ID isn't set, so the storefront behaves exactly
// as before until the owner adds a Pixel ID on Railway.
//
// The loader below is the standard fbevents.js bootstrap rewritten as plain
// TypeScript, so the codebase still has no inline <script> or
// dangerouslySetInnerHTML (see the CSP note in next.config.mjs).

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let initialised = false;

/** Creates the fbq queue, loads fbevents.js once and calls fbq('init'). Safe to call repeatedly. */
export function ensureMetaPixel(): boolean {
  if (!META_PIXEL_ID || typeof window === 'undefined') return false;
  if (initialised && window.fbq) return true;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  window.fbq('init', META_PIXEL_ID);
  initialised = true;
  return true;
}

export type MetaEventName = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

export type MetaEventParams = {
  value?: number;
  currency?: 'EGP';
  content_ids?: string[];
  content_name?: string;
  content_type?: 'product';
  contents?: { id: string; quantity: number; item_price?: number }[];
  num_items?: number;
  order_id?: string;
};

/**
 * Sends a standard event. `eventId` lets Meta de-duplicate it against the same
 * event sent server-side through the Conversions API (lib/meta/capi.ts).
 * Never throws — tracking must never break shopping.
 */
export function trackMeta(event: MetaEventName, params?: MetaEventParams, eventId?: string): void {
  try {
    if (!ensureMetaPixel() || !window.fbq) return;
    if (eventId) window.fbq('track', event, params ?? {}, { eventID: eventId });
    else if (params) window.fbq('track', event, params);
    else window.fbq('track', event);
  } catch {
    // Ignore: an ad blocker or a failed script load must not affect the page.
  }
}
