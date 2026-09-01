import { prisma } from '@/lib/prisma';
import type { DateRange } from './dates';
import { netLineRevenue } from './products';

export interface CategoryPerformance {
  categoryId: string | null;
  name: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  percentOfRevenue: number;
}

/**
 * Ranks product categories by revenue from paid orders in `range`. Order
 * items without a resolvable category (variant/product deleted, or product
 * has no category assigned) are grouped under "Uncategorized" rather than
 * dropped, so category totals never silently undercount total revenue.
 * Revenue is discount-prorated per `netLineRevenue` so category totals
 * reconcile with the order-level revenue KPI.
 */
export async function getCategoryPerformance(range: DateRange): Promise<CategoryPerformance[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: 'PAID', createdAt: { gte: range.start, lt: range.end } } },
    select: {
      quantity: true,
      subtotal: true,
      orderId: true,
      order: { select: { subtotal: true, discount: true } },
      variant: { select: { product: { select: { category: { select: { id: true, name: true } } } } } },
    },
  });

  if (items.length === 0) return [];

  interface Acc {
    name: string;
    unitsSold: number;
    revenue: number;
    orderIds: Set<string>;
  }
  const byCategory = new Map<string | null, Acc>();

  for (const item of items) {
    const category = item.variant?.product.category ?? null;
    const key = category?.id ?? null;
    const acc = byCategory.get(key) ?? { name: category?.name ?? 'Uncategorized', unitsSold: 0, revenue: 0, orderIds: new Set() };
    acc.unitsSold += item.quantity;
    acc.revenue += netLineRevenue(item.subtotal, item.order);
    acc.orderIds.add(item.orderId);
    byCategory.set(key, acc);
  }

  const totalRevenue = Array.from(byCategory.values()).reduce((sum, c) => sum + c.revenue, 0);

  return Array.from(byCategory.entries())
    .map(([categoryId, acc]) => ({
      categoryId,
      name: acc.name,
      unitsSold: acc.unitsSold,
      revenue: acc.revenue,
      orderCount: acc.orderIds.size,
      percentOfRevenue: totalRevenue > 0 ? (acc.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
