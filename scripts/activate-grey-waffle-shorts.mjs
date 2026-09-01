// Attaches product photos to the Grey Waffle Short and flips it from
// POS_ONLY to ACTIVE now that photos are ready (it was seeded photo-less
// and POS-only by add-sweatpants-and-shorts.mjs).
//
// Usage (local):      node scripts/activate-grey-waffle-shorts.mjs
// Usage (production): run the same command from Railway's service Console
//                      (Settings → Connect/Console), which already has
//                      MERRIER_DATABASE_URL set to production.
// Safe to re-run — images are only created if none exist yet, and the
// status update is a no-op if it's already ACTIVE.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'grey-waffle-short';
const IMAGES = [
  { url: '/products/grey-waffle-short/01-front.png', altText: 'Grey Waffle Short — front, flat lay' },
  { url: '/products/grey-waffle-short/02-back.png', altText: 'Grey Waffle Short — back, flat lay' },
];

async function main() {
  const product = await prisma.product.findUnique({
    where: { slug: SLUG },
    include: { images: true },
  });

  if (!product) {
    console.error(`No product with slug "${SLUG}" — run add-sweatpants-and-shorts.mjs first.`);
    process.exit(1);
  }

  if (product.images.length === 0) {
    await prisma.productImage.createMany({
      data: IMAGES.map((img, i) => ({
        productId: product.id,
        url: img.url,
        altText: img.altText,
        position: i,
        colorValue: 'Grey',
      })),
    });
    console.log(`Added ${IMAGES.length} image(s) to "${product.name}".`);
  } else {
    console.log(`"${product.name}" already has images — skipping image insert.`);
  }

  if (product.status !== 'ACTIVE') {
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'ACTIVE' },
    });
    console.log(`"${product.name}" flipped to ACTIVE.`);
  } else {
    console.log(`"${product.name}" is already ACTIVE.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
