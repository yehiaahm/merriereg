// Adds the White Super Loose Sweatpants (winter collection) to the catalog,
// ACTIVE on the storefront, in the "Pants" category (so it counts toward the
// pants bundle and uses the Sweats height-suggestion size chart for Find my
// size once that chart exists in the database). Photos are committed under
// public/products/white-super-loose-sweatpants/.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-white-super-loose-sweatpants.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'White Super Loose Sweatpants';
const COLOR = 'White';
const COLOR_HEX = '#f2efe9';
// Prices are stored in piastres: 1199 EGP = 119900.
const PRICE = 119900;
const STOCK = { S: 6, M: 5, L: 6, XL: 4 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'pants' },
    update: {},
    create: { name: 'Pants', slug: 'pants' },
  });

  const product = {
    name: NAME,
    slug: 'white-super-loose-sweatpants',
    description: 'Super loose fit sweatpants in white with a wide leg and side pockets.',
    status: 'ACTIVE',
    images: [
      { file: '01-full-length.jpg', alt: 'full length' },
      { file: '02-full-length-2.jpg', alt: 'full length, styled' },
      { file: '03-full-length-3.jpg', alt: 'full length, hands in pockets' },
      { file: '04-full-length-crossed-arms.jpg', alt: 'full length, styled' },
      { file: '05-seated.jpg', alt: 'seated' },
    ].map((img) => ({
      url: `/products/white-super-loose-sweatpants/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-SWEATP-LOOSE-WHT-${size}`,
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
