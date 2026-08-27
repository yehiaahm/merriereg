import { prisma } from '@/lib/prisma';

export const productCardInclude = {
  images: { orderBy: { position: 'asc' as const }, take: 8 },
  variants: { where: { active: true } },
};

export async function listActiveProducts(options: { categorySlug?: string } = {}) {
  return prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      ...(options.categorySlug ? { category: { slug: options.categorySlug } } : {}),
    },
    include: productCardInclude,
    orderBy: { createdAt: 'desc' },
  });
}

// Everything sellable at the POS terminal: storefront-visible products plus
// POS_ONLY ones that are deliberately kept off the website.
export async function listSellableProducts() {
  return prisma.product.findMany({
    where: { status: { in: ['ACTIVE', 'POS_ONLY'] } },
    include: productCardInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { position: 'asc' } },
      variants: true,
    },
  });
}

export function productPriceRange(variants: { price: number; compareAtPrice: number | null; active: boolean }[]) {
  const active = variants.filter((v) => v.active);
  if (active.length === 0) return { min: 0, max: 0, hasSale: false };
  const prices = active.map((v) => v.price);
  const hasSale = active.some((v) => v.compareAtPrice && v.compareAtPrice > v.price);
  return { min: Math.min(...prices), max: Math.max(...prices), hasSale };
}

export function productTotalStock(variants: { stock: number; active: boolean }[]) {
  return variants.filter((v) => v.active).reduce((sum, v) => sum + v.stock, 0);
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}
