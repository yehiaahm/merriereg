// One-off price update for the live catalog — run this from Railway's
// service Console (Settings → the "Connect"/Console tab), which already
// has MERRIER_DATABASE_URL set to production, so no credentials need to be
// copied anywhere:
//
//   node scripts/update-live-prices.mjs
//
// Matches products by name (case-insensitive) rather than SKU, so it
// updates every color/size variant of each garment in one pass. Safe to
// re-run — it just re-applies the same prices.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RULES = [
  { label: 'T-Shirt', nameContains: 'T-Shirt', price: 74900 },
  { label: 'Sweatpants', nameContains: 'Sweatpants', price: 84900 },
  { label: 'Shorts', nameContains: 'Short', price: 44900 },
];

async function main() {
  for (const rule of RULES) {
    const products = await prisma.product.findMany({
      where: { name: { contains: rule.nameContains, mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    if (products.length === 0) {
      console.log(`${rule.label}: no matching products found — skipping.`);
      continue;
    }

    const result = await prisma.productVariant.updateMany({
      where: { productId: { in: products.map((p) => p.id) } },
      data: { price: rule.price },
    });

    console.log(
      `${rule.label}: updated ${result.count} variant(s) across ${products.length} product(s) to ${rule.price / 100} EGP — ${products.map((p) => p.name).join(', ')}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
