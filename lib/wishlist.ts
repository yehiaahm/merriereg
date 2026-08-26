import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { productCardInclude } from '@/lib/products';

const WISHLIST_COOKIE = 'merrier_wishlist_id';
// 180 days: "save for later" intent is longer-lived than an in-progress
// cart (60 days) — a visitor may return to a saved item across a season.
const WISHLIST_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export const wishlistInclude = {
  items: {
    include: { product: { include: productCardInclude } },
    orderBy: { createdAt: 'asc' as const },
  },
};

export async function getWishlistById(id: string) {
  return prisma.wishlist.findUnique({ where: { id }, include: wishlistInclude });
}

/** Reads the wishlist referenced by the visitor's cookie, if any. Does not create one. */
export async function getCurrentWishlist() {
  const store = await cookies();
  const id = store.get(WISHLIST_COOKIE)?.value;
  if (!id) return null;
  return getWishlistById(id);
}

/** Reads the current wishlist, creating a new empty one (and setting its cookie) if needed. */
export async function getOrCreateWishlist() {
  const existing = await getCurrentWishlist();
  if (existing) return existing;

  const wishlist = await prisma.wishlist.create({ data: {} });
  const store = await cookies();
  store.set(WISHLIST_COOKIE, wishlist.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WISHLIST_COOKIE_MAX_AGE,
  });
  return getWishlistById(wishlist.id);
}

/** Set of wishlisted product ids — O(1) lookups when rendering a grid of cards. */
export function wishlistedProductIds(wishlist: { items: { productId: string }[] } | null) {
  return new Set(wishlist?.items.map((i) => i.productId) ?? []);
}

export { WISHLIST_COOKIE };
