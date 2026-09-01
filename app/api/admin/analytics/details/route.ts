import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { parseDateRangeParams, parseGranularity, RangeParseError } from '@/lib/analytics/parse-range';
import { getPreviousPeriod } from '@/lib/analytics/dates';
import { computeDelta } from '@/lib/analytics/format';
import { getSalesSeries } from '@/lib/analytics/timeseries';
import { getBestSellingProducts } from '@/lib/analytics/products';
import { getCategoryPerformance } from '@/lib/analytics/categories';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher — this second check is
// defense in depth in case that matcher is ever narrowed (see lib/pos.ts's
// route for the same reasoning).
export async function GET(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let range;
  try {
    range = parseDateRangeParams(req);
  } catch (err) {
    if (err instanceof RangeParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  const granularity = parseGranularity(req);
  const prev = getPreviousPeriod(range);

  const [series, bestProducts, categories, revenueAgg, prevRevenueAgg, paidOrderCount, prevPaidOrderCount, orderCount, prevOrderCount] =
    await Promise.all([
      getSalesSeries(range, granularity),
      getBestSellingProducts(range, 10),
      getCategoryPerformance(range),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'PAID', createdAt: { gte: range.start, lt: range.end } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'PAID', createdAt: { gte: prev.start, lt: prev.end } } }),
      prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: range.start, lt: range.end } } }),
      prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: prev.start, lt: prev.end } } }),
      prisma.order.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
      prisma.order.count({ where: { createdAt: { gte: prev.start, lt: prev.end } } }),
    ]);

  const revenue = revenueAgg._sum.total ?? 0;
  const prevRevenue = prevRevenueAgg._sum.total ?? 0;
  // AOV = total revenue from paid orders / number of paid orders — cancelled,
  // pending, failed and refunded orders never enter either side of this ratio.
  const aov = paidOrderCount > 0 ? Math.round(revenue / paidOrderCount) : 0;
  const prevAov = prevPaidOrderCount > 0 ? Math.round(prevRevenue / prevPaidOrderCount) : 0;

  return NextResponse.json({
    series,
    granularity,
    bestProducts,
    categories,
    comparison: {
      revenue: computeDelta(revenue, prevRevenue),
      orders: computeDelta(orderCount, prevOrderCount),
      aov: computeDelta(aov, prevAov),
    },
    // No visitor/session tracking exists in this app (confirmed by codebase
    // audit) — reporting a fabricated conversion rate would be worse than
    // reporting none. `available: false` lets the UI show a clear, honest
    // "not available" state instead of a fake percentage.
    conversionRate: { available: false, reason: 'No visitor/session tracking is implemented yet.' },
  });
}
