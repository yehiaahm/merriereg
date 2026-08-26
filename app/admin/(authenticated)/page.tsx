import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';

export const metadata = { title: 'Admin Dashboard' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [orderCount, pendingCount, revenueAgg, lowStockVariants, recentOrders] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: 'PAID' },
    }),
    prisma.productVariant.findMany({
      where: { active: true, stock: { gt: 0 } },
      include: { product: true },
    }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  const lowStock = lowStockVariants.filter((v) => v.stock <= v.lowStockThreshold);

  const stats = [
    { label: 'Total Orders', value: orderCount },
    { label: 'Pending Orders', value: pendingCount },
    { label: 'Revenue (Paid)', value: formatEGP(revenueAgg._sum.total ?? 0) },
    { label: 'Low Stock Variants', value: lowStock.length },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Dashboard</h1>

      <Link
        href="/admin/pos"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          border: '1px solid var(--ink)',
          background: 'var(--ink)',
          color: 'var(--cream)',
          padding: '18px 22px',
          marginBottom: 24,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.2a2 2 0 0 0 2-1.6L21 8H6" />
        </svg>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 20, letterSpacing: '0.03em' }}>POS</div>
          <div style={{ fontSize: 12, color: 'var(--cream-2)' }}>Point of Sale — ring up an in-store sale</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>Open &rarr;</span>
      </Link>

      <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ border: '1px solid var(--line)', padding: 18 }}>
            <div className="eyebrow">{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="admin-columns-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32 }}>
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Recent Orders</h2>
          <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
                  </td>
                  <td>{o.customerName}</td>
                  <td>{formatEGP(o.total)}</td>
                  <td>
                    <span className="badge badge-status">{o.status}</span>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--ink-soft)' }}>
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Low Stock</h2>
          {lowStock.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Nothing low on stock.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStock.map((v) => (
                <li key={v.id} style={{ fontSize: 13, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <Link href={`/admin/products/${v.productId}`}>{v.product.name}</Link> — {v.color}/{v.size}:{' '}
                  <strong>{v.stock} left</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
