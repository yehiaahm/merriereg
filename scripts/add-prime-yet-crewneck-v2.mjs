// Adds the "I'm Not Even In My Prime Yet" Boxy Fit Crewneck V2 (winter
// collection; embroidery on the back) to the catalog, ACTIVE on the
// storefront, in the "Sweatshirts" category. Photos are committed under
// public/products/prime-yet-boxy-crewneck-v2/.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-prime-yet-crewneck-v2.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'I’m Not Even In My Prime Yet Boxy Fit Crewneck V2';
const COLOR = 'Brown';
const COLOR_HEX = '#4a3a35';
// Prices are stored in piastres: 999 EGP = 99900.
const PRICE = 99900;
const STOCK = { S: 2, M: 2, L: 2, XL: 2 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'sweatshirts' },
    update: {},
    create: { name: 'Sweatshirts', slug: 'sweatshirts' },
  });

  const product = {
    name: NAME,
    slug: 'im-not-even-in-my-prime-yet-boxy-fit-crewneck-v2',
    description:
      'Boxy fit mock-neck crewneck in brown with a drop shoulder and ribbed cuffs and hem. Cream embroidery across the back reads "I\'m not even in my prime yet and they already hating", with MERRIER embroidered on the sleeve cuff.',
    status: 'ACTIVE',
    images: [
      { file: '01-front.jpg', alt: 'front' },
      { file: '02-three-quarter.jpg', alt: 'three-quarter view' },
      { file: '03-side.jpg', alt: 'side' },
      { file: '04-back.jpg', alt: 'back, embroidery' },
      { file: '05-side-with-bag.jpg', alt: 'side, styled with a tote bag' },
    ].map((img) => ({
      url: `/products/prime-yet-boxy-crewneck-v2/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-CREWNECK-V2-BRN-${size}`,
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
