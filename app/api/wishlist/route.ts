import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentWishlist, getOrCreateWishlist } from '@/lib/wishlist';
import { wishlistToggleSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const wishlist = await getCurrentWishlist();
  return NextResponse.json({ items: wishlist?.items ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = wishlistToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const { productId } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'This product is not available.' }, { status: 409 });
  }

  const wishlist = await getOrCreateWishlist();
  if (!wishlist) return NextResponse.json({ error: 'Could not create wishlist.' }, { status: 500 });

  // A plain `create` wrapped in a P2002 catch — not `upsert` — because
  // Prisma's Postgres upsert isn't atomic against a genuine concurrent
  // insert of the same row: two POSTs in flight (a double-click) can both
  // pass the upsert's internal existence check before either row commits,
  // so one still throws the unique-constraint violation. Catching it here
  // and treating it as success is what actually makes this idempotent.
  try {
    await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
      throw err;
    }
  }

  const updated = await getCurrentWishlist();
  return NextResponse.json({ items: updated!.items }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = wishlistToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const wishlist = await getCurrentWishlist();
  if (wishlist) {
    const item = wishlist.items.find((i) => i.productId === parsed.data.productId);
    if (item) {
      try {
        await prisma.wishlistItem.delete({ where: { id: item.id } });
      } catch (err) {
        // P2025 = record already gone — a concurrent DELETE for the same
        // item beat this one to it. Removing something already absent is a
        // no-op, not an error, same reasoning as the POST side's P2002 catch.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')) {
          throw err;
        }
      }
    }
  }

  const updated = await getCurrentWishlist();
  return NextResponse.json({ items: updated?.items ?? [] });
}
