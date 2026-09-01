import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { OverviewDashboard } from '@/components/admin/OverviewDashboard';
import { RecentOrders } from '@/components/admin/RecentOrders';
import { RecentActivity } from '@/components/admin/RecentActivity';
import { getRecentActivity } from '@/lib/analytics/activity';

export const metadata = { title: 'Admin Dashboard' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [recentOrders, recentActivity, lowStockVariants] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
    }),
    getRecentActivity(10),
    prisma.productVariant.findMany({
      where: { active: true, stock: { gt: 0 } },
      include: { product: true },
    }),
  ]);
  const lowStock = lowStockVariants.filter((v) => v.stock <= v.lowStockThreshold);

  return (
    <div>
      <div className="admin-page-head">
        <h1>Dashboard</h1>
      </div>

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
          marginBottom: 28,
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

      <OverviewDashboard />

      <div className="admin-columns-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recent Orders</h2>
            <Link href="/admin/orders" style={{ fontSize: 12, fontWeight: 700 }}>
              View all &rarr;
            </Link>
          </div>
          <RecentOrders orders={recentOrders} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>Recent Activity</h2>
            </div>
            <RecentActivity events={recentActivity} />
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>Low Stock</h2>
            </div>
            {lowStock.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>Nothing low on stock.</p>
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
    </div>
  );
}
