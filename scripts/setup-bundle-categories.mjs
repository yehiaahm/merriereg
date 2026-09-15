// Splits the catalog into the three categories the "3-for-a-fixed-price"
// bundle promo (see lib/promotions.ts BUNDLE_RULES) keys off of: pants,
// t-shirts, shorts. Existing products are reassigned by slug; the old
// catch-all "Apparel" category is left in place only if something still
// references it (e.g. an archived product outside these three lines).
//
// Plain .mjs (not TypeScript via tsx) so it runs with just `node`, matching
// scripts/seed-real-catalog.mjs — safe to run from Railway's own service
// Console against production too.
//
// Usage: npm run db:setup-bundle-categories
// Safe to re-run: upserts categories, and only touches a product's
// categoryId if it matches one of the slug lists below.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_ASSIGNMENTS = {
  't-shirts': {
    name: 'T-Shirts',
    slugs: ['black-acid-washed-oversized-tee', 'beige-acid-washed-oversized-tee', 'olive-acid-washed-oversized-tee'],
  },
  shorts: {
    name: 'Shorts',
    slugs: ['black-waffle-knit-shorts', 'grey-waffle-short'],
  },
  pants: {
    name: 'Pants',
    slugs: [
      'blue-wide-leg-sweatpants',
      'navy-blue-wide-leg-sweatpants',
      // POS_ONLY — not sold on the storefront, but still "pants" for catalog purposes.
      'grey-wide-leg-sweatpants',
      'black-wide-leg-sweatpants',
    ],
  },
};

async function main() {
  for (const [slug, { name, slugs }] of Object.entries(CATEGORY_ASSIGNMENTS)) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });

    const { count } = await prisma.product.updateMany({
      where: { slug: { in: slugs } },
      data: { categoryId: category.id },
    });
    console.log(`"${name}" (${slug}): ${count} product(s) assigned.`);
  }

  // Drop the old catch-all category once nothing references it any more —
  // it's now a dead filter button on /products otherwise.
  const apparel = await prisma.category.findUnique({ where: { slug: 'apparel' } });
  if (apparel) {
    const remaining = await prisma.product.count({ where: { categoryId: apparel.id } });
    if (remaining === 0) {
      await prisma.category.delete({ where: { id: apparel.id } });
      console.log('Removed empty "Apparel" category.');
    } else {
      console.log(`"Apparel" category kept — ${remaining} product(s) still reference it.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
