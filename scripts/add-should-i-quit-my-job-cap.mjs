// Adds the "Should I Quit My Job?" Acid Washed Cap (winter collection) to the
// catalog, ACTIVE on the storefront, in the "Caps" category. One size only.
// Photos are committed under public/products/should-i-quit-my-job-cap/.
//
// Caps have no size chart, so there's no "Find my size" on this product (and
// the product page shows no size-recommendation note for single-size items).
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-should-i-quit-my-job-cap.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'SHOULD I QUIT MY JOB? Acid Washed Cap';
const COLOR = 'Green';
const COLOR_HEX = '#3f7a5f';
// Prices are stored in piastres: 399 EGP = 39900.
const PRICE = 39900;
const STOCK = { 'One Size': 5 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'caps' },
    update: {},
    create: { name: 'Caps', slug: 'caps' },
  });

  const product = {
    name: NAME,
    slug: 'should-i-quit-my-job-acid-washed-cap',
    description:
      'Acid washed cap in green with white "SHOULD I QUIT MY JOB?" embroidery across the front and an embroidered M on the back. Adjustable strap with a metal buckle.',
    status: 'ACTIVE',
    images: [
      { file: '01-front.jpg', alt: 'front' },
      { file: '02-back.jpg', alt: 'back, embroidered M' },
    ].map((img) => ({
      url: `/products/should-i-quit-my-job-cap/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: 'MR-CAP-SQJ-GRN-OS',
      price: PRICE,
      stock,
    })),
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
  console.log(`Created "${product.name}" (One Size, ${PRICE / 100} EGP, ${STOCK['One Size']} in stock).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
