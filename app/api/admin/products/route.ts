import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productInputSchema } from '@/lib/validation';
import { egpToPiastres } from '@/lib/money';
import { getCurrentCustomer } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher — this second check is
// defense in depth in case that matcher is ever narrowed (see lib/pos.ts's
// route for the same reasoning).
export async function GET() {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    include: { variants: true, category: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product data' }, { status: 400 });
  }
  const input = parsed.data;

  const slugTaken = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (slugTaken) {
    return NextResponse.json({ error: 'A product with this slug already exists.' }, { status: 409 });
  }

  const skus = input.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    return NextResponse.json({ error: 'Variant SKUs must be unique within the product.' }, { status: 400 });
  }
  const existingSkus = await prisma.productVariant.findMany({ where: { sku: { in: skus } } });
  if (existingSkus.length > 0) {
    return NextResponse.json(
      { error: `SKU already in use: ${existingSkus.map((v) => v.sku).join(', ')}` },
      { status: 409 }
    );
  }

  let categoryId = input.categoryId || null;
  if (input.newCategoryName) {
    const catSlug = input.newCategoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const category = await prisma.category.upsert({
      where: { slug: catSlug },
      update: { name: input.newCategoryName },
      create: { name: input.newCategoryName, slug: catSlug },
    });
    categoryId = category.id;
  }

  const product = await prisma.product.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: input.status,
      categoryId,
      images: {
        create: input.images.map((img, i) => ({
          url: img.url,
          altText: img.altText || null,
          colorValue: img.colorValue || null,
          position: i,
        })),
      },
      variants: {
        create: input.variants.map((v) => ({
          size: v.size,
          color: v.color,
          colorHex: v.colorHex || null,
          sku: v.sku,
          price: egpToPiastres(v.priceEGP),
          compareAtPrice: v.compareAtPriceEGP ? egpToPiastres(v.compareAtPriceEGP) : null,
          stock: v.stock,
          lowStockThreshold: v.lowStockThreshold ?? 3,
          active: v.active ?? true,
        })),
      },
    },
    include: { variants: true, images: true },
  });

  return NextResponse.json({ product }, { status: 201 });
}
