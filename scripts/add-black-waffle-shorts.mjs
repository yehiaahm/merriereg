// Adds the Black Waffle Knit Shorts to the catalog, ACTIVE on the
// storefront (unlike the still-photo-less Grey Waffle Short, which stays
// POS_ONLY).
//
// Usage: node scripts/add-black-waffle-shorts.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: { name: 'Apparel', slug: 'apparel' },
  });

  const product = {
    name: 'Black Waffle Knit Shorts',
    slug: 'black-waffle-knit-shorts',
    description: 'Waffle knit shorts in black.',
    status: 'ACTIVE',
    images: [
      { url: '/products/black-waffle-knit-shorts/02-front.png', altText: 'Black Waffle Knit Shorts — front', colorValue: 'Black' },
      { url: '/products/black-waffle-knit-shorts/01-back.jpg', altText: 'Black Waffle Knit Shorts — back', colorValue: 'Black' },
    ],
    variants: [
      { size: 'S', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-WAFSHORT-BLK-S', price: 44900, stock: 0 },
      { size: 'M', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-WAFSHORT-BLK-M', price: 44900, stock: 3 },
      { size: 'L', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-WAFSHORT-BLK-L', price: 44900, stock: 3 },
      { size: 'XL', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-WAFSHORT-BLK-XL', price: 44900, stock: 3 },
    ],
  };

  const existing = await prisma.product.findUnique({ where: { slug: product.slug } });
  if (existing) {
    console.log(`"${product.name}" already exists — skipping.`);
    return;
  }

  await prisma.product.create({
    data: {
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      categoryId: category.id,
      images: { create: product.images.map((img, i) => ({ ...img, position: i })) },
      variants: { create: product.variants },
    },
  });
  console.log(`Created "${product.name}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
