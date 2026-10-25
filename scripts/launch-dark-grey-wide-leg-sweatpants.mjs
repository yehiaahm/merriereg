// Puts the Dark Grey Wide Leg Sweatpants on the website (winter collection).
//
// This product already exists in the catalog as "Grey Wide Leg Sweatpants":
// scripts/add-sweatpants-and-shorts.mjs created it as POS_ONLY (in-store only,
// no photos, 849 EGP). This script *updates* that product rather than creating
// a new one (its slug and SKUs are already taken):
//   - renamed "Dark Grey Wide Leg Sweatpants" (color Dark Grey) to match the
//     real colour in the photos; slug and SKUs are kept, so the POS and any
//     links keep working
//   - status POS_ONLY -> ACTIVE (visible on the website)
//   - price 899 EGP and stock S6 / M6 / L6 / XL5 on its existing variants
//   - photos from public/products/dark-grey-wide-leg-sweatpants/ and a description
//   - category Pants, so it counts toward the "3 pants" bundle and uses the
//     Sweats height-suggestion size chart (Find my size) once that chart exists
// If the product doesn't exist yet, it is created with the same values.
//
// NOTE: stock is shared with the POS terminal — the numbers below replace
// whatever is currently in the database for this product.
//
// Safe to re-run: once the product is ACTIVE and has photos it is skipped, so
// stock/price are never reset after the launch.
//
// Plain .mjs so it runs from Railway's service Console, like the other
// catalog scripts.
//
// Usage: node scripts/launch-dark-grey-wide-leg-sweatpants.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'grey-wide-leg-sweatpants';
const NAME = 'Dark Grey Wide Leg Sweatpants';
const OLD_COLOR = 'Grey';
const COLOR = 'Dark Grey';
const COLOR_HEX = '#5b5c64';
// Prices are stored in piastres: 899 EGP = 89900.
const PRICE = 89900;
const STOCK = { S: 6, M: 6, L: 6, XL: 5 };
const DESCRIPTION = 'Wide leg sweatpants in dark grey with a light blue embroidered M on the thigh.';
const IMAGES = [
  { file: '01-front-logo.jpg', alt: 'front, embroidered M' },
  { file: '02-side.jpg', alt: 'side' },
].map((img) => ({
  url: `/products/dark-grey-wide-leg-sweatpants/${img.file}`,
  altText: `${NAME} — ${img.alt}`,
  colorValue: COLOR,
}));

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'pants' },
    update: {},
    create: { name: 'Pants', slug: 'pants' },
  });

  const existing = await prisma.product.findUnique({
    where: { slug: SLUG },
    include: { variants: true, images: true },
  });

  if (existing && existing.status === 'ACTIVE' && existing.images.length > 0) {
    console.log(`"${existing.name}" is already live — skipping (stock and price are left as they are).`);
    return;
  }

  if (!existing) {
    await prisma.product.create({
      data: {
        name: NAME,
        slug: SLUG,
        description: DESCRIPTION,
        status: 'ACTIVE',
        categoryId: category.id,
        images: { create: IMAGES.map((img, i) => ({ ...img, position: i })) },
        variants: {
          create: Object.entries(STOCK).map(([size, stock]) => ({
            size,
            color: COLOR,
            colorHex: COLOR_HEX,
            sku: `MR-SWEATP-GRY-${size}`,
            price: PRICE,
            stock,
          })),
        },
      },
    });
    console.log(`Created "${NAME}" (${Object.keys(STOCK).length} sizes, ${PRICE / 100} EGP) and put it on the website.`);
    return;
  }

  const before = existing.variants.map((v) => `${v.size}:${v.stock}`).join(' ');
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: existing.id },
      data: { name: NAME, status: 'ACTIVE', description: DESCRIPTION, categoryId: category.id },
    });

    for (const [size, stock] of Object.entries(STOCK)) {
      // Match the old "Grey" variant (or an already-renamed one) by size.
      const variant = existing.variants.find((v) => v.size === size && (v.color === OLD_COLOR || v.color === COLOR));
      const data = { color: COLOR, colorHex: COLOR_HEX, price: PRICE, stock, active: true };
      if (variant) {
        await tx.productVariant.update({ where: { id: variant.id }, data });
      } else {
        await tx.productVariant.create({ data: { ...data, productId: existing.id, size, sku: `MR-SWEATP-GRY-${size}` } });
      }
    }

    await tx.productImage.deleteMany({ where: { productId: existing.id } });
    await tx.productImage.createMany({ data: IMAGES.map((img, i) => ({ ...img, productId: existing.id, position: i })) });
  });

  console.log(`Updated "${existing.name}" -> "${NAME}": now ACTIVE on the website at ${PRICE / 100} EGP.`);
  console.log(`Stock before -> after: ${before}  ->  ${Object.entries(STOCK).map(([s, n]) => `${s}:${n}`).join(' ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
