// Adds the "Elegance In Scilence" Regular Shoulder Boxy Fit Hoodie (winter
// collection) to the catalog, ACTIVE on the storefront, in a "Hoodies"
// category. Photos are committed under public/products/elegance-in-scilence-hoodie/.
//
// If the owner-supplied "Hoodie (height suggestion)" size chart is already in
// the database (npm run db:seed-size-charts / scripts/seed-size-charts.mjs),
// the hoodie is linked to it so "Find my size" shows on the product page;
// otherwise it's created without one and says so.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-elegance-in-scilence-hoodie.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'ELEGANCE IN SCILENCE Regular Shoulder Boxy Fit Hoodie';
const COLOR = 'Charcoal';
const COLOR_HEX = '#52535c';
// Prices are stored in piastres: 1199 EGP = 119900.
const PRICE = 119900;
const STOCK = { S: 4, M: 6, L: 6, XL: 6 };
const SIZE_CHART_NAME = 'Hoodie (height suggestion)';

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: { name: 'Hoodies', slug: 'hoodies' },
  });

  const product = {
    name: NAME,
    slug: 'elegance-in-scilence-regular-shoulder-boxy-fit-hoodie',
    description:
      'Boxy fit hoodie in charcoal grey with a regular shoulder, kangaroo pocket and ribbed cuffs and hem. Light blue embroidery across the chest reads "Elegance in scilence", with MERRIER embroidered on the sleeve cuff.',
    status: 'ACTIVE',
    images: [
      { file: '01-front.jpg', alt: 'front' },
      { file: '02-full-length.jpg', alt: 'full length' },
      { file: '03-side-right.jpg', alt: 'side, right' },
      { file: '04-side-left.jpg', alt: 'side, left' },
      { file: '05-back.jpg', alt: 'back' },
    ].map((img) => ({
      url: `/products/elegance-in-scilence-hoodie/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-HOODIE-ELEG-CHR-${size}`,
      price: PRICE,
      stock,
    })),
  };

  const existing = await prisma.product.findUnique({ where: { slug: product.slug } });
  if (existing) {
    console.log(`"${product.name}" already exists — skipping.`);
    return;
  }

  const sizeChart = await prisma.sizeChart.findFirst({ where: { name: SIZE_CHART_NAME, verified: true } });

  await prisma.product.create({
    data: {
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      categoryId: category.id,
      sizeChartId: sizeChart?.id ?? null,
      images: { create: product.images.map((img, i) => ({ ...img, position: i })) },
      variants: { create: product.variants },
    },
  });
  console.log(`Created "${product.name}" (${product.variants.length} sizes, ${PRICE / 100} EGP).`);
  console.log(
    sizeChart
      ? `Linked to size chart "${SIZE_CHART_NAME}" — Find my size is on.`
      : `Size chart "${SIZE_CHART_NAME}" not found — run scripts/seed-size-charts.mjs, then link it from the product's edit page in /admin/products.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
