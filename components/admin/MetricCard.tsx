import type { Delta } from '@/lib/analytics/format';

function formatPercent(percent: number | null): string {
  if (percent === null) return 'New';
  const rounded = Math.round(Math.abs(percent) * 10) / 10;
  return `${percent >= 0 ? '+' : '-'}${rounded}%`;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel = 'vs previous period',
  sub,
}: {
  label: string;
  value: string;
  delta?: Delta;
  deltaLabel?: string;
  sub?: string;
}) {
  return (
    <div className="admin-metric-card">
      <div className="eyebrow">{label}</div>
      <div className="admin-metric-value">{value}</div>
      {delta && (
        <div className="admin-metric-delta" data-direction={delta.direction}>
          {delta.direction === 'up' && '▲'}
          {delta.direction === 'down' && '▼'}
          {delta.direction === 'flat' && '—'}
          <span>{formatPercent(delta.percent)}</span>
          <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{deltaLabel}</span>
        </div>
      )}
      {sub && <div className="admin-metric-sub">{sub}</div>}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="admin-metric-card">
      <div className="skeleton" style={{ width: '50%', height: 12 }} />
      <div className="skeleton" style={{ width: '70%', height: 28 }} />
      <div className="skeleton" style={{ width: '40%', height: 12 }} />
    </div>
  );
}
