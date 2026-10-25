// Adds the Brown Super Loose Sweatpants (winter collection) to the catalog,
// ACTIVE on the storefront, in the "Pants" category (so it counts toward the
// pants bundle and uses the Sweats height-suggestion size chart for Find my
// size once that chart exists in the database). Photos are committed under
// public/products/brown-super-loose-sweatpants/.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-brown-super-loose-sweatpants.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'Brown Super Loose Sweatpants';
const COLOR = 'Brown';
const COLOR_HEX = '#4a3a35';
// Prices are stored in piastres: 1199 EGP = 119900.
const PRICE = 119900;
const STOCK = { S: 3, M: 3, L: 3, XL: 2 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'pants' },
    update: {},
    create: { name: 'Pants', slug: 'pants' },
  });

  const product = {
    name: NAME,
    slug: 'brown-super-loose-sweatpants',
    description: 'Super loose fit sweatpants in brown with a wide leg and side pockets.',
    status: 'ACTIVE',
    images: [
      { file: '01-full-length.jpg', alt: 'full length' },
      { file: '02-full-length-styled.jpg', alt: 'full length, styled' },
      { file: '03-full-length-pocket.jpg', alt: 'full length, hand in pocket' },
      { file: '04-side-full-length.jpg', alt: 'side, full length' },
      { file: '05-set.jpg', alt: 'styled with the matching top' },
      { file: '06-set-closeup.jpg', alt: 'styled, close up' },
      { file: '07-seated.jpg', alt: 'styled, seated' },
      { file: '08-seated-2.jpg', alt: 'styled, seated, close up' },
      { file: '09-set-styled.jpg', alt: 'styled' },
      { file: '10-back.jpg', alt: 'styled, back of the top' },
    ].map((img) => ({
      url: `/products/brown-super-loose-sweatpants/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-SWEATP-LOOSE-BRN-${size}`,
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
  console.log(`Created "${product.name}" (${product.variants.length} sizes, ${PRICE / 100} EGP).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
