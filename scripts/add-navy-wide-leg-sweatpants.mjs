// Adds the Navy Blue Wide Leg Sweatpants to the catalog, ACTIVE with photos
// from day one (unlike the Grey/Black Wide Leg Sweatpants, which are still
// POS_ONLY without photos). Stock mirrors the Grey pair's counts.
//
// Usage (local):      node scripts/add-navy-wide-leg-sweatpants.mjs
// Usage (production): run the same command from Railway's service Console
//                      (Settings → Connect/Console), which already has
//                      MERRIER_DATABASE_URL set to production.
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: { name: 'Apparel', slug: 'apparel' },
  });

  const slug = 'navy-blue-wide-leg-sweatpants';
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    console.log('"Navy Blue Wide Leg Sweatpants" already exists — skipping.');
    return;
  }

  await prisma.product.create({
    data: {
      name: 'Navy Blue Wide Leg Sweatpants',
      slug,
      description: 'Wide leg sweatpants in navy blue.',
      status: 'ACTIVE',
      categoryId: category.id,
      images: {
        create: [
          { url: '/products/navy-blue-wide-leg-sweatpants/01-front.jpg', altText: 'Navy Blue Wide Leg Sweatpants — model wearing pants, front view', position: 0, colorValue: 'Navy' },
          { url: '/products/navy-blue-wide-leg-sweatpants/02-back.jpg', altText: 'Navy Blue Wide Leg Sweatpants — model wearing pants, back view', position: 1, colorValue: 'Navy' },
          { url: '/products/navy-blue-wide-leg-sweatpants/03-side.jpg', altText: 'Navy Blue Wide Leg Sweatpants — model wearing pants, side view', position: 2, colorValue: 'Navy' },
          { url: '/products/navy-blue-wide-leg-sweatpants/04-side-pocket-detail.jpg', altText: 'Navy Blue Wide Leg Sweatpants — side pocket detail', position: 3, colorValue: 'Navy' },
        ],
      },
      variants: {
        create: [
          { size: 'S', color: 'Navy', colorHex: '#1b2436', sku: 'MR-SWEATP-NVY-S', price: 84900, stock: 6 },
          { size: 'M', color: 'Navy', colorHex: '#1b2436', sku: 'MR-SWEATP-NVY-M', price: 84900, stock: 6 },
          { size: 'L', color: 'Navy', colorHex: '#1b2436', sku: 'MR-SWEATP-NVY-L', price: 84900, stock: 4 },
          { size: 'XL', color: 'Navy', colorHex: '#1b2436', sku: 'MR-SWEATP-NVY-XL', price: 84900, stock: 1 },
        ],
      },
    },
  });
  console.log('Created "Navy Blue Wide Leg Sweatpants" (ACTIVE).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
