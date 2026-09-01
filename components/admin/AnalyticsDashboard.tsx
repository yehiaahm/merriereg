'use client';

import { useState } from 'react';
import { DateRangeProvider, useDateRange } from './DateRangeContext';
import { DateRangePicker } from './DateRangePicker';
import { MetricCard, MetricCardSkeleton } from './MetricCard';
import { TimeSeriesChart } from './TimeSeriesChart';
import { BestSellingProducts } from './BestSellingProducts';
import { CategoryPerformance } from './CategoryPerformance';
import { LoadingBlock, LoadingRows } from './LoadingState';
import { ErrorState } from './ErrorState';
import { useAnalyticsFetch } from './useAnalyticsFetch';
import { formatEGP } from '@/lib/money';
import type { Delta } from '@/lib/analytics/format';
import type { BestSellingProduct } from '@/lib/analytics/products';
import type { CategoryPerformance as CategoryPerformanceRow } from '@/lib/analytics/categories';

type Granularity = 'day' | 'week' | 'month';

interface DetailsResponse {
  series: { bucketStart: string; revenue: number; orders: number }[];
  granularity: Granularity;
  bestProducts: BestSellingProduct[];
  categories: CategoryPerformanceRow[];
  comparison: { revenue: Delta; orders: Delta; aov: Delta };
  conversionRate: { available: false; reason: string };
}

function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  return (
    <div className="admin-btn-group">
      {(['day', 'week', 'month'] as const).map((g) => (
        <button key={g} type="button" aria-pressed={value === g} onClick={() => onChange(g)}>
          {g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}
        </button>
      ))}
    </div>
  );
}

function AnalyticsInner() {
  const { queryString } = useDateRange();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const { data, loading, error } = useAnalyticsFetch<DetailsResponse>(
    `/api/admin/analytics/details?${queryString}&granularity=${granularity}`
  );

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <DateRangePicker />
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>

      <div className="admin-kpi-grid">
        {loading || !data ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Revenue" value={formatEGP(data.comparison.revenue.current)} delta={data.comparison.revenue} />
            <MetricCard label="Orders" value={String(data.comparison.orders.current)} delta={data.comparison.orders} />
            <MetricCard label="Avg. Order Value" value={formatEGP(data.comparison.aov.current)} delta={data.comparison.aov} />
            <MetricCard
              label="Conversion Rate"
              value="Not available"
              sub="No visitor/session tracking is implemented yet."
            />
          </>
        )}
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head">
          <h2>Revenue</h2>
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

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head">
          <h2>Orders</h2>
        </div>
        {error ? (
          <ErrorState message={error} />
        ) : loading || !data ? (
          <LoadingBlock />
        ) : (
          <TimeSeriesChart
            buckets={data.series.map((b) => ({ bucketStart: b.bucketStart, value: b.orders }))}
            granularity={data.granularity}
            formatValue={(v) => String(v)}
            color="var(--ink)"
            ariaLabel="Order volume over time"
          />
        )}
      </div>

      <div className="admin-columns-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Best-Selling Products</h2>
          </div>
          {error ? <ErrorState message={error} /> : loading || !data ? <LoadingRows rows={6} height={44} /> : <BestSellingProducts products={data.bestProducts} />}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Category Performance</h2>
          </div>
          {error ? <ErrorState message={error} /> : loading || !data ? <LoadingRows rows={5} height={36} /> : <CategoryPerformance categories={data.categories} />}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  return (
    <DateRangeProvider initial={{ preset: 'thisMonth' }}>
      <AnalyticsInner />
    </DateRangeProvider>
  );
}
