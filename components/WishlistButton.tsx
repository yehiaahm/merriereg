'use client';

import { useWishlistToggle } from '@/components/useWishlistToggle';

export function WishlistButton({ productId, isWishlisted }: { productId: string; isWishlisted: boolean }) {
  const { wishlisted, busy, toggle, Toast } = useWishlistToggle(productId, isWishlisted);

  return (
    <>
      <button type="button" className="mr-btn-ghost" onClick={toggle} disabled={busy}>
        {wishlisted ? 'In Wishlist ♥' : 'Add to Wishlist ♡'}
      </button>
      {Toast}
    </>
  );
}
