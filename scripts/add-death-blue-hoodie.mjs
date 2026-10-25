// Adds the "DEATH" Oversized Blue Hoodie (winter collection) to the catalog,
// ACTIVE on the storefront, in the "Hoodies" category. Only sizes L and XL
// are in stock. Photos are committed under
// public/products/death-oversized-blue-hoodie/.
//
// This hoodie is deliberately NOT linked to the "Hoodie (height suggestion)"
// size chart: it's a different garment (oversized, different price point) and
// the chart wasn't supplied for it, so Find my size stays off until a chart
// is linked from the product's edit page in /admin/products.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-death-blue-hoodie.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'DEATH Oversized Blue Hoodie';
const COLOR = 'Royal Blue';
const COLOR_HEX = '#2d52b8';
// Prices are stored in piastres: 499 EGP = 49900.
const PRICE = 49900;
const STOCK = { L: 2, XL: 2 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: { name: 'Hoodies', slug: 'hoodies' },
  });

  const product = {
    name: NAME,
    slug: 'death-oversized-blue-hoodie',
    description:
      'Oversized hoodie in royal blue with a kangaroo pocket and ribbed cuffs and hem. MERRIER is printed vertically down the front, and a black and white "DEATH" illustration is printed across the back.',
    status: 'ACTIVE',
    images: [
      { file: '01-front-flat.jpg', alt: 'front' },
      { file: '02-back-flat.jpg', alt: 'back, printed illustration' },
      { file: '03-back-print.jpg', alt: 'back print, close up' },
      { file: '04-front-bench.jpg', alt: 'front, styled' },
      { file: '05-back-seat.jpg', alt: 'back, styled' },
    ].map((img) => ({
      url: `/products/death-oversized-blue-hoodie/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-HOODIE-DEATH-BLU-${size}`,
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
  console.log(`Created "${product.name}" (sizes ${Object.keys(STOCK).join(', ')}, ${PRICE / 100} EGP).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
