// Adds the "OVERDOSE" Oversized Black Hoodie (winter collection) to the
// catalog, ACTIVE on the storefront, in the "Hoodies" category. Only one piece
// is left: size XL. Photos are committed under
// public/products/overdose-oversized-black-hoodie/.
//
// Like the DEATH hoodie, it is deliberately NOT linked to the "Hoodie (height
// suggestion)" size chart (different garment/price point, no chart supplied),
// so Find my size stays off until a chart is linked from the product's edit
// page in /admin/products. With a single size there's nothing to recommend
// between anyway, and the product page shows no recommendation note.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// add-*.mjs catalog scripts.
//
// Usage: node scripts/add-overdose-black-hoodie.mjs
// Safe to re-run: skipped (not duplicated) if the slug already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'OVERDOSE Oversized Black Hoodie';
const COLOR = 'Black';
const COLOR_HEX = '#1a1a1a';
// Prices are stored in piastres: 499 EGP = 49900.
const PRICE = 49900;
const STOCK = { XL: 1 };

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: { name: 'Hoodies', slug: 'hoodies' },
  });

  const product = {
    name: NAME,
    slug: 'overdose-oversized-black-hoodie',
    description:
      'Oversized hoodie in black with a drop shoulder and ribbed cuffs and hem. A large blue "OVERDOSE FRIDAY CLUB" illustration is printed across the back. Last piece, size XL.',
    status: 'ACTIVE',
    images: [
      { file: '01-back-print.jpg', alt: 'back, printed illustration' },
      { file: '02-back-styled.jpg', alt: 'back, styled' },
      { file: '03-back-seated.jpg', alt: 'back, seated' },
      { file: '04-back-arcade.jpg', alt: 'back, styled' },
    ].map((img) => ({
      url: `/products/overdose-oversized-black-hoodie/${img.file}`,
      altText: `${NAME} — ${img.alt}`,
      colorValue: COLOR,
    })),
    variants: Object.entries(STOCK).map(([size, stock]) => ({
      size,
      color: COLOR,
      colorHex: COLOR_HEX,
      sku: `MR-HOODIE-OVERDOSE-BLK-${size}`,
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
  console.log(`Created "${product.name}" (size XL, 1 in stock, ${PRICE / 100} EGP).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
