import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { piastresToEgp } from '@/lib/money';
import { listCategories } from '@/lib/products';
import { ProductForm } from '@/components/admin/ProductForm';

export const metadata = { title: 'Admin — Edit Product' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: true, images: { orderBy: { position: 'asc' } } },
    }),
    listCategories(),
  ]);

  if (!product) notFound();

  const initial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    status: product.status,
    categoryId: product.categoryId,
    images: product.images.map((img) => ({
      url: img.url,
      altText: img.altText ?? '',
      colorValue: img.colorValue ?? '',
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex ?? '',
      sku: v.sku,
      priceEGP: String(piastresToEgp(v.price)),
      compareAtPriceEGP: v.compareAtPrice ? String(piastresToEgp(v.compareAtPrice)) : '',
      stock: String(v.stock),
      active: v.active,
    })),
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Edit Product</h1>
      <ProductForm initial={initial} categories={categories} />
    </div>
  );
}
