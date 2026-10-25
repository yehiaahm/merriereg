// Archives every product currently visible on the website (status ACTIVE) so
// the storefront can be cleared before a new collection goes up.
//
// Archiving is NOT deletion — it's the same thing the admin's delete button
// does: the product (and its variants, images and order history) stays in the
// database, disappears from the storefront, and can be switched back to
// Active from /admin/products at any time. Checkout also refuses any product
// that isn't ACTIVE, so an archived item can't be bought from an old cart.
//
// Left alone on purpose: DRAFT, POS_ONLY (in-store only, not on the website)
// and already-ARCHIVED products.
//
// Plain .mjs so it runs from Railway's service Console with no extra tooling.
//
// Usage:
//   npm run db:archive-products              # dry run: lists what WOULD be archived
//   npm run db:archive-products -- --yes     # actually archives them
// Safe to re-run: products that are already archived are skipped.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const confirmed = process.argv.includes('--yes');

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  if (products.length === 0) {
    console.log('No ACTIVE products — nothing to archive.');
    return;
  }

  console.log(`${confirmed ? 'Archiving' : 'Would archive'} ${products.length} product(s):`);
  for (const p of products) console.log(`  - ${p.name} (${p.slug})`);

  if (!confirmed) {
    console.log('\nDry run only — nothing was changed. Re-run with --yes to archive them.');
    return;
  }

  const { count } = await prisma.product.updateMany({
    where: { id: { in: products.map((p) => p.id) } },
    data: { status: 'ARCHIVED' },
  });
  console.log(`\nArchived ${count} product(s). Restore any of them from /admin/products (set status back to Active).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
