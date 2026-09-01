// Permanently deletes every order currently in the database (used to wipe
// out test/dummy orders placed during development before going live).
//
// For each order NOT already CANCELLED/RETURNED, restores the stock that was
// decremented at checkout (see lib/orders.ts's createOrderFromCart) — mirrors
// what app/api/admin/orders/[id]/route.ts does on a CANCELLED/RETURNED
// transition. Orders already CANCELLED/RETURNED already had their stock
// restored, so they're deleted as-is. OrderItem and Payment rows cascade-
// delete with their parent Order (see prisma/schema.prisma).
//
// Usage (dry run — lists orders, deletes nothing):
//   node scripts/delete-test-orders.mjs
// Usage (actually delete):
//   node scripts/delete-test-orders.mjs --confirm
//
// Usage (production): run the same command from Railway's service Console
//                      (Settings → Connect/Console), which already has
//                      MERRIER_DATABASE_URL set to production.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes('--confirm');

async function main() {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });

  if (orders.length === 0) {
    console.log('No orders found — nothing to do.');
    return;
  }

  console.log(`Found ${orders.length} order(s):\n`);
  for (const o of orders) {
    console.log(
      `  ${o.orderNumber}  ${o.status.padEnd(10)}  ${o.customerName.padEnd(20)}  ${(o.total / 100).toFixed(2)} EGP  ${o.items.length} item(s)  ${o.createdAt.toISOString()}`
    );
  }

  if (!CONFIRM) {
    console.log('\nDry run only — nothing deleted. Re-run with --confirm to permanently delete these orders.');
    return;
  }

  for (const order of orders) {
    await prisma.$transaction(async (tx) => {
      const stockAlreadyRestored = order.status === 'CANCELLED' || order.status === 'RETURNED';
      if (!stockAlreadyRestored) {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }
      await tx.order.delete({ where: { id: order.id } });
    });
    console.log(`Deleted ${order.orderNumber}.`);
  }

  console.log(`\nDeleted ${orders.length} order(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
