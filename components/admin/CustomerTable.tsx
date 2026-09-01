import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { EmptyState } from './EmptyState';
import type { CustomerListRow, CustomerSort } from '@/lib/analytics/customers';

const STATUS_BADGE_CLASS: Record<string, string> = {
  New: 'badge-new',
  Active: 'badge-sale',
  Returning: 'badge-status',
  Inactive: 'badge-out',
};

function SortableHeader({
  label,
  column,
  activeSort,
  activeDir,
  buildHref,
}: {
  label: string;
  column: CustomerSort;
  activeSort: CustomerSort;
  activeDir: 'asc' | 'desc';
  buildHref: (column: CustomerSort) => string;
}) {
  const isActive = activeSort === column;
  return (
    <th aria-sort={isActive ? (activeDir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link href={buildHref(column)}>
        {label}
        {isActive && <span>{activeDir === 'asc' ? ' ▲' : ' ▼'}</span>}
      </Link>
    </th>
  );
}

export function CustomerTable({
  rows,
  sort,
  dir,
  buildSortHref,
}: {
  rows: CustomerListRow[];
  sort: CustomerSort;
  dir: 'asc' | 'desc';
  buildSortHref: (column: CustomerSort) => string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No customers match" message="Try a different search or filter." />;
  }

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <SortableHeader label="Name" column="name" activeSort={sort} activeDir={dir} buildHref={buildSortHref} />
            <th>Email</th>
            <SortableHeader label="Orders" column="orderCount" activeSort={sort} activeDir={dir} buildHref={buildSortHref} />
            <SortableHeader label="Total Spend" column="totalSpend" activeSort={sort} activeDir={dir} buildHref={buildSortHref} />
            <SortableHeader label="Last Order" column="lastOrderAt" activeSort={sort} activeDir={dir} buildHref={buildSortHref} />
            <th>Status</th>
            <SortableHeader label="Registered" column="registeredAt" activeSort={sort} activeDir={dir} buildHref={buildSortHref} />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/admin/customers/${c.id}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>
                  {c.name}
                </Link>
              </td>
              <td>{c.email}</td>
              <td>{c.orderCount}</td>
              <td>{formatEGP(c.totalSpend)}</td>
              <td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
              <td>
                <span className={`badge ${STATUS_BADGE_CLASS[c.status]}`}>{c.status}</span>
              </td>
              <td>{new Date(c.registeredAt).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
