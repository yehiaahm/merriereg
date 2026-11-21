'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackMeta } from '@/lib/meta/pixel-client';
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_DAYS,
  attributionFromSearch,
  serializeAttribution,
} from '@/lib/meta/attribution';

/**
 * Storefront-only (mounted in app/(storefront)/layout.tsx, never on /admin):
 *  1. Saves UTM tags / fbclid from the landing URL into a first-party cookie
 *     (last touch wins), so checkout can store the ad source on the order.
 *     This runs even without a Pixel ID — attribution works on its own.
 *  2. Sends a Meta PageView on every client-side navigation (the App Router
 *     doesn't reload the page, so the Pixel would otherwise see only the
 *     first page).
 */
export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    try {
      const attribution = attributionFromSearch(search);
      if (attribution) {
        const maxAge = ATTRIBUTION_MAX_AGE_DAYS * 24 * 60 * 60;
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${ATTRIBUTION_COOKIE}=${serializeAttribution(attribution)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
      }
    } catch {
      // Cookies disabled — attribution is best-effort.
    }
    trackMeta('PageView');
  }, [pathname, search]);

  return null;
}
