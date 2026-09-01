import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DateRange } from './dates';
import { CAIRO_OFFSET_MS } from './dates';

export type Granularity = 'day' | 'week' | 'month';

export interface SalesBucket {
  bucketStart: Date;
  revenue: number;
  orders: number;
}

// Only these exact literals are ever interpolated into date_trunc() — never
// request-supplied text — so this can't become a SQL-injection vector.
const TRUNC_UNIT: Record<Granularity, string> = { day: 'day', week: 'week', month: 'month' };

/**
 * Revenue + order-volume time series bucketed by day/week/month, computed
 * entirely in Postgres (no fetch-everything-then-reduce-in-JS) so this stays
 * fast as order volume grows.
 *
 * Buckets are aligned to Africa/Cairo local time: `createdAt` is shifted by
 * the fixed +2:00 offset before truncation, then shifted back for the
 * returned bucket boundary, so a Cairo calendar day is never split across
 * two buckets just because the server stores UTC timestamps.
 */
export async function getSalesSeries(range: DateRange, granularity: Granularity): Promise<SalesBucket[]> {
  const unit = TRUNC_UNIT[granularity];
  const offset = `${CAIRO_OFFSET_MS} milliseconds`;

  const rows = await prisma.$queryRaw<{ bucket: Date; revenue: bigint | null; orders: bigint }[]>(
    Prisma.sql`
      SELECT
        (date_trunc(${unit}, "createdAt" + ${offset}::interval) - ${offset}::interval) AS bucket,
        SUM(CASE WHEN "paymentStatus" = 'PAID' THEN "total" ELSE 0 END)::bigint AS revenue,
        COUNT(*)::bigint AS orders
      FROM "Order"
      WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.end}
      GROUP BY bucket
      ORDER BY bucket ASC
    `
  );

  return rows.map((r) => ({
    bucketStart: r.bucket,
    revenue: Number(r.revenue ?? 0),
    orders: Number(r.orders),
  }));
}
