// Adds the Blue Wide Leg Sweatpants to the catalog, ACTIVE on the
// storefront (photos are ready, unlike the still-photo-less Grey/Black
// Wide Leg Sweatpants seeded by add-sweatpants-and-shorts.mjs).
//
// Usage: node scripts/add-blue-wide-leg-sweatpants.mjs
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
    name: 'Blue Wide Leg Sweatpants',
    slug: 'blue-wide-leg-sweatpants',
    description: 'Wide leg sweatpants in blue.',
    status: 'ACTIVE',
    images: [
      { url: '/products/blue-wide-leg-sweatpants/01-front.jpg', altText: 'Blue Wide Leg Sweatpants — front', colorValue: 'Blue' },
      { url: '/products/blue-wide-leg-sweatpants/02-back.jpg', altText: 'Blue Wide Leg Sweatpants — back', colorValue: 'Blue' },
      { url: '/products/blue-wide-leg-sweatpants/03-side.jpg', altText: 'Blue Wide Leg Sweatpants — side', colorValue: 'Blue' },
      { url: '/products/blue-wide-leg-sweatpants/04-side-detail.jpg', altText: 'Blue Wide Leg Sweatpants — side detail', colorValue: 'Blue' },
    ],
    variants: [
      { size: 'S', color: 'Blue', colorHex: '#3b4a63', sku: 'MR-SWEATP-BLU-S', price: 84900, stock: 6 },
      { size: 'M', color: 'Blue', colorHex: '#3b4a63', sku: 'MR-SWEATP-BLU-M', price: 84900, stock: 6 },
      { size: 'L', color: 'Blue', colorHex: '#3b4a63', sku: 'MR-SWEATP-BLU-L', price: 84900, stock: 4 },
      { size: 'XL', color: 'Blue', colorHex: '#3b4a63', sku: 'MR-SWEATP-BLU-XL', price: 84900, stock: 1 },
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
