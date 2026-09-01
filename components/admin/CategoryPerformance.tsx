import { formatEGP } from '@/lib/money';
import { EmptyState } from './EmptyState';
import type { CategoryPerformance as CategoryPerformanceRow } from '@/lib/analytics/categories';

export function CategoryPerformance({ categories }: { categories: CategoryPerformanceRow[] }) {
  if (categories.length === 0) {
    return <EmptyState title="No category data" message="Nothing sold in this period yet." />;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {categories.map((c, i) => (
        <li key={c.categoryId ?? 'uncategorized'} className="admin-rank-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
              <span>
                {i + 1}. {c.name}
              </span>
              <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{c.unitsSold} units · {c.orderCount} orders</span>
            </div>
            <div className="admin-rank-bar-track">
              <div className="admin-rank-bar-fill" style={{ width: `${Math.max(2, c.percentOfRevenue)}%` }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: 13 }}>{formatEGP(c.revenue)}</strong>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{c.percentOfRevenue.toFixed(1)}%</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
