import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCart, getOrCreateCart, cartTotals } from '@/lib/cart';
import { addToCartSchema, updateCartItemSchema, removeCartItemSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cart = await getCurrentCart();
  if (!cart) return NextResponse.json({ items: [], subtotal: 0, itemCount: 0 });
  return NextResponse.json({ items: cart.items, ...cartTotals(cart) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = addToCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const { variantId, quantity } = parsed.data;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant || !variant.active || variant.product.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'This product is not available.' }, { status: 409 });
  }

  const cart = await getOrCreateCart();
  if (!cart) return NextResponse.json({ error: 'Could not create cart.' }, { status: 500 });

  const existing = cart.items.find((i) => i.variantId === variantId);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;

  if (variant.stock < nextQuantity) {
    return NextResponse.json(
      { error: `Only ${variant.stock} left in stock for ${variant.size} / ${variant.color}.` },
      { status: 409 }
    );
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity },
    update: { quantity: nextQuantity },
  });

  const updated = await getCurrentCart();
  return NextResponse.json({ items: updated!.items, ...cartTotals(updated!) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const { itemId, quantity } = parsed.data;

  const cart = await getCurrentCart();
  if (!cart) return NextResponse.json({ error: 'Cart not found.' }, { status: 404 });

  const item = cart.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: 'Item not found in your cart.' }, { status: 404 });

  if (item.variant.stock < quantity) {
    return NextResponse.json({ error: `Only ${item.variant.stock} left in stock.` }, { status: 409 });
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });

  const updated = await getCurrentCart();
  return NextResponse.json({ items: updated!.items, ...cartTotals(updated!) });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = removeCartItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const cart = await getCurrentCart();
  if (!cart) return NextResponse.json({ error: 'Cart not found.' }, { status: 404 });

  const item = cart.items.find((i) => i.id === parsed.data.itemId);
  if (!item) return NextResponse.json({ error: 'Item not found in your cart.' }, { status: 404 });

  await prisma.cartItem.delete({ where: { id: item.id } });

  const updated = await getCurrentCart();
  return NextResponse.json({ items: updated?.items ?? [], ...cartTotals(updated ?? { items: [] }) });
}
