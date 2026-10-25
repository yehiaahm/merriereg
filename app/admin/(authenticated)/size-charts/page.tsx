import Link from 'next/link';
import { listSizeCharts } from '@/lib/sizing/charts';
import { parseStoredChart } from '@/lib/sizing/chart-schema';

export const metadata = { title: 'Admin — Size Charts' };
export const dynamic = 'force-dynamic';

export default async function AdminSizeChartsPage() {
  const charts = await listSizeCharts();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 28 }}>Size Charts</h1>
        <Link href="/admin/size-charts/new" className="btn btn-primary">
          + Add Size Chart
        </Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 720, marginBottom: 24, lineHeight: 1.6 }}>
        Find My Size recommends sizes only from charts you enter and mark <strong>verified</strong> here. A product shows the
        size finder when its own chart — or, failing that, its category&apos;s chart — is verified. Nothing is estimated or
        pre-filled.
      </p>

      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Numbers describe</th>
              <th>Status</th>
              <th>Used by</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {charts.map((c) => {
              const valid = parseStoredChart(c) !== null;
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.basis === 'BODY' ? 'Body' : 'Garment'}</td>
                  <td>
                    {!valid ? (
                      <span className="badge badge-out">Invalid — fix to use</span>
                    ) : c.verified ? (
                      <span className="badge badge-status">Verified</span>
                    ) : (
                      <span className="badge badge-out">Draft</span>
                    )}
                  </td>
                  <td>
                    {c._count.products} product{c._count.products === 1 ? '' : 's'}, {c._count.categories} categor
                    {c._count.categories === 1 ? 'y' : 'ies'}
                  </td>
                  <td style={{ maxWidth: 260 }}>{c.source ?? <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                  <td>
                    <Link href={`/admin/size-charts/${c.id}`} style={{ fontSize: 13, fontWeight: 700 }}>
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {charts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--ink-soft)' }}>
                  No size charts yet — products won&apos;t show Find My Size until you add and verify one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
