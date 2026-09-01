import Link from 'next/link';
import { listCustomers, type CustomerSort, type CustomerStatus } from '@/lib/analytics/customers';
import { CustomerTable } from '@/components/admin/CustomerTable';

export const metadata = { title: 'Admin — Customers' };
export const dynamic = 'force-dynamic';

const STATUSES: CustomerStatus[] = ['New', 'Active', 'Returning', 'Inactive'];
const SORT_COLUMNS: CustomerSort[] = ['name', 'orderCount', 'totalSpend', 'lastOrderAt', 'registeredAt'];
const PAGE_SIZE = 20;

function isCustomerSort(value: string | undefined): value is CustomerSort {
  return !!value && (SORT_COLUMNS as string[]).includes(value);
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = STATUSES.includes(params.status as CustomerStatus) ? (params.status as CustomerStatus) : undefined;
  const sort: CustomerSort = isCustomerSort(params.sort) ? params.sort : 'registeredAt';
  const dir: 'asc' | 'desc' = params.dir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(params.page) || 1);

  const result = await listCustomers({ q, status, sort, sortDir: dir, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    next.set('sort', sort);
    next.set('dir', dir);
    if (page > 1) next.set('page', String(page));
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    return `/admin/customers${qs ? `?${qs}` : ''}`;
  }

  function buildSortHref(column: CustomerSort) {
    const nextDir = sort === column && dir === 'desc' ? 'asc' : 'desc';
    return buildHref({ sort: column, dir: nextDir, page: undefined });
  }

  return (
    <div>
      <div className="admin-page-head">
        <h1>Customers</h1>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{result.total} total</span>
      </div>

      <form style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone"
          className="admin-input"
          style={{ flex: '1 1 220px', minWidth: 0, maxWidth: 320 }}
        />
        <select name="status" defaultValue={status ?? ''} className="admin-select">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <button type="submit" className="btn btn-outline">
          Filter
        </button>
      </form>

      <div className="admin-panel">
        <CustomerTable rows={result.rows} sort={sort} dir={dir} buildSortHref={buildSortHref} />
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <Link
            href={buildHref({ page: String(Math.max(1, page - 1)) })}
            className="btn btn-outline"
            style={{ minHeight: 36, padding: '0 14px', pointerEvents: page <= 1 ? 'none' : undefined, opacity: page <= 1 ? 0.4 : 1 }}
          >
            Previous
          </Link>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildHref({ page: String(Math.min(totalPages, page + 1)) })}
            className="btn btn-outline"
            style={{ minHeight: 36, padding: '0 14px', pointerEvents: page >= totalPages ? 'none' : undefined, opacity: page >= totalPages ? 0.4 : 1 }}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
