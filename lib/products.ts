import { prisma } from '@/lib/prisma';

export const productCardInclude = {
  category: true,
  images: { orderBy: { position: 'asc' as const }, take: 8 },
  variants: { where: { active: true } },
};

// Products pinned to the very top of the home page grid and the Shop page
// (default "Newest" order), in this order. Everything else follows, newest
// first. To change what customers see first, edit this list (use the
// product's slug — it's the last part of its page URL). A slug that isn't
// active (archived, draft, typo) is simply skipped.
export const FEATURED_PRODUCT_SLUGS = [
  'ive-been-ghosting-you-cuz-im-working-boxy-fit-crewneck',
  'grey-wide-leg-sweatpants', // "Dark Grey Wide Leg Sweatpants"
  'im-not-even-in-my-prime-yet-boxy-fit-crewneck-v2',
  'ive-been-ghosting-you-cuz-im-working-boxy-fit-hoodie',
];

/** Moves the featured slugs to the front (in list order); the rest keep their order. */
export function pinFeaturedFirst<T extends { slug: string }>(products: T[]): T[] {
  const rank = (slug: string) => {
    const i = FEATURED_PRODUCT_SLUGS.indexOf(slug);
    return i === -1 ? FEATURED_PRODUCT_SLUGS.length : i;
  };
  // Array.prototype.sort is stable, so non-featured products keep newest-first.
  return [...products].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export async function listActiveProducts(options: { categorySlug?: string } = {}) {
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      ...(options.categorySlug ? { category: { slug: options.categorySlug } } : {}),
    },
    include: productCardInclude,
    orderBy: { createdAt: 'desc' },
  });
  return pinFeaturedFirst(products);
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
