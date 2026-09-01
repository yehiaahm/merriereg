import { prisma } from '@/lib/prisma';
import type { DateRange } from './dates';

export interface BestSellingProduct {
  key: string;
  productId: string | null;
  name: string;
  imageUrl: string | null;
  status: string; // ProductStatus, or 'DELETED' for a since-removed product
  unitsSold: number;
  revenue: number;
}

/**
 * An order's flat, un-allocated discount (Order.discount — tier promo and/or
 * coupon, see lib/orders.ts) prorated onto one line item, so per-product and
 * per-category revenue reconcile with the order-level revenue KPI instead of
 * quietly reporting pre-discount gross. Falls back to the raw line subtotal
 * when the order has no subtotal to prorate against (shouldn't happen for a
 * real order, but avoids a division by zero).
 */
export function netLineRevenue(lineSubtotal: number, order: { subtotal: number; discount: number }): number {
  if (order.subtotal <= 0) return lineSubtotal;
  const keepRatio = (order.subtotal - order.discount) / order.subtotal;
  return Math.round(lineSubtotal * keepRatio);
}

/**
 * Ranks products by revenue from paid orders in `range`, grouped at the
 * *product* level (not per-variant) so a product with 5 color/size variants
 * shows up once with combined units/revenue, per the spec's "variants
 * should not cause duplicate products" requirement.
 *
 * OrderItem snapshots product/variant details at purchase time and only
 * loosely references the live ProductVariant (SetNull on delete), so a
 * variant — or its whole product — can be gone by the time this runs. Those
 * order items are grouped by their snapshotted `productName` instead and
 * shown with a "DELETED" status, rather than being silently dropped or
 * miscounted.
 */
export async function getBestSellingProducts(range: DateRange, limit = 10): Promise<BestSellingProduct[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: 'PAID', createdAt: { gte: range.start, lt: range.end } } },
    select: {
      variantId: true,
      productName: true,
      imageUrl: true,
      quantity: true,
      subtotal: true,
      order: { select: { subtotal: true, discount: true } },
    },
  });

  if (items.length === 0) return [];

  const variantIds = items.map((i) => i.variantId).filter((id): id is string => id !== null);
  const variants =
    variantIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            product: {
              select: { id: true, name: true, status: true, images: { orderBy: { position: 'asc' }, take: 1 } },
            },
          },
        })
      : [];
  const variantToProduct = new Map(variants.map((v) => [v.id, v.product]));

  const byKey = new Map<string, BestSellingProduct>();
  for (const item of items) {
    const product = item.variantId ? variantToProduct.get(item.variantId) : undefined;
    const key = product ? `product:${product.id}` : `deleted:${item.productName}`;
    const revenue = netLineRevenue(item.subtotal, item.order);

    const existing = byKey.get(key);
    if (existing) {
      existing.unitsSold += item.quantity;
      existing.revenue += revenue;
      continue;
    }

    byKey.set(key, {
      key,
      productId: product?.id ?? null,
      name: product?.name ?? item.productName,
      imageUrl: product?.images[0]?.url ?? item.imageUrl,
      status: product?.status ?? 'DELETED',
      unitsSold: item.quantity,
      revenue,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
