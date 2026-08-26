import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productInputSchema } from '@/lib/validation';
import { egpToPiastres } from '@/lib/money';
import { getCurrentCustomer } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher — this second check is
// defense in depth in case that matcher is ever narrowed (see lib/pos.ts's
// route for the same reasoning).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true, images: { orderBy: { position: 'asc' } } },
  });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product data' }, { status: 400 });
  }
  const input = parsed.data;

  const existing = await prisma.product.findUnique({ where: { id }, include: { variants: true } });
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  if (input.slug !== existing.slug) {
    const slugTaken = await prisma.product.findUnique({ where: { slug: input.slug } });
    if (slugTaken) return NextResponse.json({ error: 'A product with this slug already exists.' }, { status: 409 });
  }

  const skus = input.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    return NextResponse.json({ error: 'Variant SKUs must be unique within the product.' }, { status: 400 });
  }
  const conflictingSkus = await prisma.productVariant.findMany({
    where: { sku: { in: skus }, productId: { not: id } },
  });
  if (conflictingSkus.length > 0) {
    return NextResponse.json(
      { error: `SKU already used by another product: ${conflictingSkus.map((v) => v.sku).join(', ')}` },
      { status: 409 }
    );
  }

  const incomingIds = new Set(input.variants.filter((v) => v.id).map((v) => v.id));
  const toDelete = existing.variants.filter((v) => !incomingIds.has(v.id));

  const product = await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.productVariant.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
    }

    for (const v of input.variants) {
      const data = {
        productId: id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex || null,
        sku: v.sku,
        price: egpToPiastres(v.priceEGP),
        compareAtPrice: v.compareAtPriceEGP ? egpToPiastres(v.compareAtPriceEGP) : null,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold ?? 3,
        active: v.active ?? true,
      };
      if (v.id) {
        await tx.productVariant.update({ where: { id: v.id }, data });
      } else {
        await tx.productVariant.create({ data });
      }
    }

    await tx.productImage.deleteMany({ where: { productId: id } });
    if (input.images.length > 0) {
      await tx.productImage.createMany({
        data: input.images.map((img, i) => ({
          productId: id,
          url: img.url,
          altText: img.altText || null,
          colorValue: img.colorValue || null,
          position: i,
        })),
      });
    }

    let categoryId = input.categoryId || null;
    if (input.newCategoryName) {
      const catSlug = input.newCategoryName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const category = await tx.category.upsert({
        where: { slug: catSlug },
        update: { name: input.newCategoryName },
        create: { name: input.newCategoryName, slug: catSlug },
      });
      categoryId = category.id;
    }

    return tx.product.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        status: input.status,
        categoryId,
      },
      include: { variants: true, images: true, category: true },
    });
  });

  return NextResponse.json({ product });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // Archive rather than hard-delete, so past orders keep meaningful history
  // (OrderItem stores a snapshot, but this also avoids surprising data loss).
  const product = await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
  return NextResponse.json({ product });
}
