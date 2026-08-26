'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/AddToCartError';

export function useWishlistToggle(productId: string, initialWishlisted: boolean) {
  const router = useRouter();
  const { show, Toast } = useToast();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [busy, setBusy] = useState(false);

  async function toggle(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !wishlisted;
    setWishlisted(next); // optimistic
    const res = await fetch('/api/wishlist', {
      method: next ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    setBusy(false);
    if (!res.ok) {
      setWishlisted(!next); // revert
      const data = await res.json().catch(() => ({}));
      show(data.error ?? 'Could not update wishlist.', 'error');
      return;
    }
    show(next ? 'Saved to your wishlist.' : 'Removed from wishlist.');
    router.refresh();
  }

  return { wishlisted, busy, toggle, Toast };
}
