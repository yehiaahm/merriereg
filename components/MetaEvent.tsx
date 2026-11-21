'use client';

import { useEffect, useRef } from 'react';
import { trackMeta, type MetaEventName, type MetaEventParams } from '@/lib/meta/pixel-client';

/**
 * Fires one Meta Pixel event when it mounts — lets server components (product,
 * checkout and order pages) send events without becoming client components.
 *
 * `onceKey` additionally suppresses repeats across reloads in the same tab
 * (e.g. refreshing the order confirmation page must not log a second
 * Purchase). Meta also de-duplicates by `eventId` against the server-side
 * Conversions API event.
 */
export function MetaEvent({
  event,
  params,
  eventId,
  onceKey,
}: {
  event: MetaEventName;
  params?: MetaEventParams;
  eventId?: string;
  onceKey?: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (onceKey) {
      try {
        const key = `mr_meta_${onceKey}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch {
        // sessionStorage unavailable — fall through and send once for this mount.
      }
    }
    trackMeta(event, params, eventId);
    // Fire-once on mount by design; props are a snapshot of the page that rendered it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
