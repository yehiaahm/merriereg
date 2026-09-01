import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { parseDateRangeParams, RangeParseError } from '@/lib/analytics/parse-range';
import { getOverviewMetrics } from '@/lib/analytics/overview';
import { getSalesSeries } from '@/lib/analytics/timeseries';
import { getBestSellingProducts } from '@/lib/analytics/products';

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

  // Bucket granularity is chosen from the range span so a year view doesn't
  // render 365 daily bars and a single day doesn't render one monthly bar.
  const spanDays = (range.end.getTime() - range.start.getTime()) / 86_400_000;
  const granularity = spanDays <= 60 ? 'day' : spanDays <= 400 ? 'week' : 'month';

  const [kpis, series, bestProducts] = await Promise.all([
    getOverviewMetrics(range),
    getSalesSeries(range, granularity),
    getBestSellingProducts(range, 5),
  ]);

  return NextResponse.json({ kpis, series, granularity, bestProducts });
}
