import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import { AccountLogoutButton } from '@/components/AccountLogoutButton';

export const metadata = { title: 'My Account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect('/account/login?next=/account');
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="container" style={{ padding: '48px 24px 100px', maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>My Account</h1>
        <AccountLogoutButton />
      </div>

      <div style={{ border: '1px solid var(--line)', background: 'var(--cream-2)', padding: 20, marginBottom: 40 }}>
        <span className="eyebrow">Profile</span>
        <p style={{ margin: '8px 0 0', fontSize: 18 }}>{customer.name}</p>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>{customer.email}</p>
        {customer.phone && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>{customer.phone}</p>}
        {customer.isAdmin && (
          <Link href="/admin" className="btn btn-outline" style={{ marginTop: 14, padding: '8px 16px', minHeight: 36 }}>
            Go to Admin Dashboard
          </Link>
        )}
      </div>

      <span className="eyebrow">Order History</span>
      {orders.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 12 }}>
          No orders yet. <Link href="/products">Start shopping.</Link>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/order/${order.id}`}
              style={{
                display: 'block',
                border: '1px solid var(--line)',
                padding: 18,
                color: 'var(--ink)',
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <span>
                  <span style={{ fontWeight: 700 }}>#{order.orderNumber}</span>
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {order.createdAt.toLocaleDateString('en-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700 }}>{formatEGP(order.total)}</span>
                  <br />
                  <span className="badge badge-status" style={{ marginTop: 4 }}>
                    {order.status}
                  </span>
                </span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--line)',
                  fontSize: 13,
                  color: 'var(--ink-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {order.items.map((item) => (
                  <span key={item.id}>
                    {item.productName} ({item.variantColor}/{item.variantSize}) &times; {item.quantity}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
