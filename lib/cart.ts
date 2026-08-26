import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const CART_COOKIE = 'merrier_cart_id';
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: { include: { images: { orderBy: { position: 'asc' as const } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

export type CartWithItems = NonNullable<Awaited<ReturnType<typeof getCartById>>>;

export async function getCartById(cartId: string) {
  return prisma.cart.findUnique({ where: { id: cartId }, include: cartInclude });
}

/** Reads the cart referenced by the visitor's cookie, if any. Does not create one. */
export async function getCurrentCart() {
  const store = await cookies();
  const cartId = store.get(CART_COOKIE)?.value;
  if (!cartId) return null;
  return getCartById(cartId);
}

/** Reads the current cart, creating a new empty one (and setting its cookie) if needed. */
export async function getOrCreateCart() {
  const existing = await getCurrentCart();
  if (existing) return existing;

  const cart = await prisma.cart.create({ data: {} });
  const store = await cookies();
  store.set(CART_COOKIE, cart.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
  return getCartById(cart.id);
}

export function cartTotals(cart: { items: { quantity: number; variant: { price: number } }[] }) {
  const subtotal = cart.items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  return { subtotal, itemCount: cart.items.reduce((n, i) => n + i.quantity, 0) };
}

export { CART_COOKIE };
