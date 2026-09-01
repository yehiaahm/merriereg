import { prisma } from '@/lib/prisma';
import type { DateRange } from './dates';
import { getPreviousPeriod } from './dates';
import { computeDelta, type Delta } from './format';

export interface OverviewMetrics {
  revenue: Delta;
  orders: Delta;
  totalCustomers: number;
  newCustomers: Delta;
}

/**
 * KPI cards for the dashboard overview: revenue, order volume, and customer
 * growth for `range`, each compared against the immediately preceding period
 * of equal length.
 *
 * Revenue counts only `paymentStatus: 'PAID'` orders — the same rule the
 * original dashboard used (see app/admin/(authenticated)/page.tsx history).
 * RETURNED orders are auto-marked REFUNDED (lib/orders status transitions),
 * so they're already excluded without extra filtering. Order *volume*
 * intentionally counts every order regardless of status, matching the
 * existing `prisma.order.count()` convention.
 */
export async function getOverviewMetrics(range: DateRange): Promise<OverviewMetrics> {
  const prev = getPreviousPeriod(range);

  const [revenueAgg, prevRevenueAgg, orderCount, prevOrderCount, totalCustomers, newCustomers, prevNewCustomers] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: range.start, lt: range.end } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: prev.start, lt: prev.end } },
      }),
      prisma.order.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
      prisma.order.count({ where: { createdAt: { gte: prev.start, lt: prev.end } } }),
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
      prisma.customer.count({ where: { createdAt: { gte: prev.start, lt: prev.end } } }),
    ]);

  return {
    revenue: computeDelta(revenueAgg._sum.total ?? 0, prevRevenueAgg._sum.total ?? 0),
    orders: computeDelta(orderCount, prevOrderCount),
    totalCustomers,
    newCustomers: computeDelta(newCustomers, prevNewCustomers),
  };
}
