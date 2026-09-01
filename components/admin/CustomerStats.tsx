import { formatEGP } from '@/lib/money';
import type { CustomerDetail } from '@/lib/analytics/customers';

function formatDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function CustomerStats({ stats }: { stats: CustomerDetail['stats'] }) {
  const items = [
    { label: 'Total Orders', value: String(stats.totalOrders) },
    { label: 'Total Spend', value: formatEGP(stats.totalSpend) },
    { label: 'Avg. Order Value', value: formatEGP(stats.averageOrderValue) },
    { label: 'First Order', value: formatDate(stats.firstOrderAt) },
    { label: 'Last Order', value: formatDate(stats.lastOrderAt) },
  ];

  return (
    <div className="admin-kpi-grid" style={{ marginBottom: 0 }}>
      {items.map((item) => (
        <div key={item.label} className="admin-metric-card">
          <div className="eyebrow">{item.label}</div>
          <div className="admin-metric-value" style={{ fontSize: 20 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
