// Adds the "I've Been Ghosting You Cuz I'm Working" Boxy Fit Crewneck (winter
// collection) to the catalog, ACTIVE on the storefront, in the "Sweatshirts"
// category. Photos are committed under public/products/ghosting-boxy-crewneck/.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-ghosting-crewneck.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'I’VE BEEN GHOSTING YOU CUZ I’M WORKING Boxy Fit Crewneck';
const COLOR = 'White';
const COLOR_HEX = '#f2efe9';
// Prices are stored in piastres: 999 EGP = 99900.
const PRICE = 99900;
const STOCK = { S: 4, M: 4, L: 4, XL: 4 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'sweatshirts' },
    update: {},
    create: { name: 'Sweatshirts', slug: 'sweatshirts' },
  });

  const product = {
    name: NAME,
    slug: 'ive-been-ghosting-you-cuz-im-working-boxy-fit-crewneck',
    description:
      'Boxy fit mock-neck crewneck in white with a drop shoulder and ribbed cuffs and hem. Tone-on-tone embroidery across the back reads "I\'ve been ghosting you cuz I\'m working".',
    status: 'ACTIVE',
    images: [
      { file: '01-front.jpg', alt: 'front' },
      { file: '02-three-quarter.jpg', alt: 'three-quarter view' },
      { file: '03-side.jpg', alt: 'side' },
      { file: '04-back.jpg', alt: 'back, embroidery' },
      { file: '05-back-detail.jpg', alt: 'back, embroidery detail' },
    ].map((img) => ({
      url: `/products/ghosting-boxy-crewneck/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-CREWNECK-WHT-${size}`,
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
