import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { EmptyState } from './EmptyState';
import type { BestSellingProduct } from '@/lib/analytics/products';

export function BestSellingProducts({ products }: { products: BestSellingProduct[] }) {
  if (products.length === 0) {
    return <EmptyState title="No sales yet" message="Best-sellers will appear once paid orders come in for this period." />;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {products.map((p, i) => (
        <li key={p.key} className="admin-rank-row">
          <span className="admin-rank-index">{i + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- thumbnails can point at arbitrary admin-pasted hosts, same as ProductCard.
              <img src={p.imageUrl} alt="" className="admin-thumb" />
            ) : (
              <div className="admin-thumb" />
            )}
            <div style={{ minWidth: 0 }}>
              {p.productId ? (
                <Link href={`/admin/products/${p.productId}`} style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </Link>
              ) : (
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
              )}
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {p.unitsSold} sold {p.status === 'DELETED' && <span className="badge badge-out" style={{ marginLeft: 6 }}>Deleted</span>}
              </div>
            </div>
          </div>
          <strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatEGP(p.revenue)}</strong>
        </li>
      ))}
    </ul>
  );
}
