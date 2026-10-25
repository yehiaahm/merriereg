// Adds the "Rare By Nature" Acid Washed Cap (winter collection) to the
// catalog, ACTIVE on the storefront, in a new "Caps" category. One size only.
// Photos are committed under public/products/rare-by-nature-cap/.
//
// Caps have no size chart, so there's no "Find my size" on this product (and
// the product page shows no size-recommendation note for single-size items).
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-rare-by-nature-cap.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'RARE BY NATURE Acid Washed Cap';
const COLOR = 'Burgundy';
const COLOR_HEX = '#8f3454';
// Prices are stored in piastres: 399 EGP = 39900.
const PRICE = 39900;
const STOCK = { 'One Size': 4 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'caps' },
    update: {},
    create: { name: 'Caps', slug: 'caps' },
  });

  const product = {
    name: NAME,
    slug: 'rare-by-nature-acid-washed-cap',
    description:
      'Acid washed cap in burgundy with cream "RARE BY NATURE" embroidery across the front and an embroidered M on the back. Adjustable strap with a metal buckle.',
    status: 'ACTIVE',
    images: [
      { file: '01-front.jpg', alt: 'front' },
      { file: '02-front-styled.jpg', alt: 'front, styled' },
      { file: '03-back.jpg', alt: 'back, embroidered M' },
      { file: '04-back-collar.jpg', alt: 'back, strap and buckle' },
      { file: '05-back-hands.jpg', alt: 'back, styled' },
      { file: '06-back-hands-2.jpg', alt: 'back, styled, close' },
    ].map((img) => ({
      url: `/products/rare-by-nature-cap/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: 'MR-CAP-RBN-BRG-OS',
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
