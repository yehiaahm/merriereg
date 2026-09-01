'use client';

import { DateRangeProvider, useDateRange } from './DateRangeContext';
import { DateRangePicker } from './DateRangePicker';
import { MetricCard, MetricCardSkeleton } from './MetricCard';
import { TimeSeriesChart } from './TimeSeriesChart';
import { BestSellingProducts } from './BestSellingProducts';
import { LoadingBlock, LoadingRows } from './LoadingState';
import { ErrorState } from './ErrorState';
import { useAnalyticsFetch } from './useAnalyticsFetch';
import { formatEGP } from '@/lib/money';
import type { Delta } from '@/lib/analytics/format';
import type { BestSellingProduct } from '@/lib/analytics/products';

interface OverviewResponse {
  kpis: {
    revenue: Delta;
    orders: Delta;
    totalCustomers: number;
    newCustomers: Delta;
  };
  series: { bucketStart: string; revenue: number; orders: number }[];
  granularity: 'day' | 'week' | 'month';
  bestProducts: BestSellingProduct[];
}

function OverviewInner() {
  const { queryString } = useDateRange();
  const { data, loading, error } = useAnalyticsFetch<OverviewResponse>(`/api/admin/analytics/overview?${queryString}`);

  return (
    <div>
      <DateRangePicker />

      <div className="admin-kpi-grid">
        {loading || !data ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Total Sales" value={formatEGP(data.kpis.revenue.current)} delta={data.kpis.revenue} />
            <MetricCard label="Total Orders" value={String(data.kpis.orders.current)} delta={data.kpis.orders} />
            <MetricCard
              label="Customers"
              value={String(data.kpis.totalCustomers)}
              delta={data.kpis.newCustomers}
              deltaLabel="new vs previous period"
            />
          </>
        )}
      </div>

      <div className="admin-columns-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Sales Performance</h2>
          </div>
          {error ? (
            <ErrorState message={error} />
          ) : loading || !data ? (
            <LoadingBlock />
          ) : (
            <TimeSeriesChart
              buckets={data.series.map((b) => ({ bucketStart: b.bucketStart, value: b.revenue }))}
              granularity={data.granularity}
              formatValue={formatEGP}
              ariaLabel="Revenue over time"
            />
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Best-Selling Products</h2>
          </div>
          {error ? <ErrorState message={error} /> : loading || !data ? <LoadingRows rows={5} height={44} /> : <BestSellingProducts products={data.bestProducts} />}
        </div>
      </div>
    </div>
  );
}

export function OverviewDashboard() {
  return (
    <DateRangeProvider initial={{ preset: 'last30' }}>
      <OverviewInner />
    </DateRangeProvider>
  );
}
