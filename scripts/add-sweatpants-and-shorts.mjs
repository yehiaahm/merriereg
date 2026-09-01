// Adds the Wide Leg Sweatpants (Grey, Black) and Grey Waffle Short to the
// catalog. These have no product photos yet, so they're seeded as POS_ONLY
// (sellable at the in-store POS terminal, hidden from the storefront) until
// photos and copy are ready to flip them to ACTIVE.
//
// Usage: node scripts/add-sweatpants-and-shorts.mjs
// Safe to re-run: each product is skipped (not duplicated) if its slug
// already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: { name: 'Apparel', slug: 'apparel' },
  });

  const products = [
    {
      name: 'Grey Wide Leg Sweatpants',
      slug: 'grey-wide-leg-sweatpants',
      description: 'Wide leg sweatpants in grey.',
      status: 'POS_ONLY',
      images: [],
      variants: [
        { size: 'S', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-SWEATP-GRY-S', price: 84900, stock: 6 },
        { size: 'M', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-SWEATP-GRY-M', price: 84900, stock: 6 },
        { size: 'L', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-SWEATP-GRY-L', price: 84900, stock: 4 },
        { size: 'XL', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-SWEATP-GRY-XL', price: 84900, stock: 1 },
      ],
    },
    {
      name: 'Black Wide Leg Sweatpants',
      slug: 'black-wide-leg-sweatpants',
      description: 'Wide leg sweatpants in black.',
      status: 'POS_ONLY',
      images: [],
      variants: [
        { size: 'S', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-SWEATP-BLK-S', price: 84900, stock: 6 },
        { size: 'M', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-SWEATP-BLK-M', price: 84900, stock: 5 },
        { size: 'L', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-SWEATP-BLK-L', price: 84900, stock: 2 },
        { size: 'XL', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-SWEATP-BLK-XL', price: 84900, stock: 2 },
      ],
    },
    {
      name: 'Grey Waffle Short',
      slug: 'grey-waffle-short',
      description: 'Waffle short in grey.',
      status: 'POS_ONLY',
      images: [],
      variants: [
        { size: 'S', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-WAFSHORT-GRY-S', price: 44900, stock: 0 },
        { size: 'M', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-WAFSHORT-GRY-M', price: 44900, stock: 3 },
        { size: 'L', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-WAFSHORT-GRY-L', price: 44900, stock: 3 },
        { size: 'XL', color: 'Grey', colorHex: '#8c8c8c', sku: 'MR-WAFSHORT-GRY-XL', price: 44900, stock: 3 },
      ],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      console.log(`"${p.name}" already exists — skipping.`);
      continue;
    }

    await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: p.status,
        categoryId: category.id,
        images: { create: p.images.map((img, i) => ({ ...img, position: i })) },
        variants: { create: p.variants },
      },
    });
    console.log(`Created "${p.name}".`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
