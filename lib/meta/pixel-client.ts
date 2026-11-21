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

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * Keeps the Pixel silent on /admin within the same browser tab.
 *
 * The Pixel is only ever loaded by storefront pages, but once loaded,
 * fbevents.js follows client-side navigation by itself (it sends its own
 * PageView on history changes). An admin who clicks the header "Admin" link,
 * or logs in from /account/login?next=/admin, would otherwise be tracked on
 * admin pages. Meta's consent API stops every Pixel request (events sent while
 * revoked are dropped, not queued), so consent is revoked *before* the URL
 * changes to an /admin path, and granted again on the way back to the store.
 * Installed before fbevents.js loads, so this runs ahead of its own listeners.
 */
function installAdminGuard(): void {
  let revoked = false;
  const sync = (url?: string | URL | null) => {
    try {
      const path = url != null ? new URL(String(url), window.location.href).pathname : window.location.pathname;
      const shouldRevoke = isAdminPath(path);
      if (shouldRevoke !== revoked) {
        revoked = shouldRevoke;
        window.fbq?.('consent', shouldRevoke ? 'revoke' : 'grant');
      }
    } catch {
      // Malformed URL: leave the current state alone.
    }
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      sync(url);
      return original.call(this, data, unused, url);
    };
  }
  window.addEventListener('popstate', () => sync());
}

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
    // Note: don't set fbq.disablePushState. fbevents.js sends only one
    // PageView per page load unless its own history tracking sees the URL
    // change, so turning it off silently drops every client-side PageView.
    // It de-duplicates against MetaPixel.tsx's PageView (one per navigation).
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    installAdminGuard();

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
    // Never track the admin area, even if a tab navigated there client-side.
    if (typeof window === 'undefined' || isAdminPath(window.location.pathname)) return;
    if (!ensureMetaPixel() || !window.fbq) return;
    if (eventId) window.fbq('track', event, params ?? {}, { eventID: eventId });
    else if (params) window.fbq('track', event, params);
    else window.fbq('track', event);
  } catch {
    // Ignore: an ad blocker or a failed script load must not affect the page.
  }
}
