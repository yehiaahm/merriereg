import { notFound } from 'next/navigation';
import { getCustomerDetail } from '@/lib/analytics/customers';
import { CustomerStats } from '@/components/admin/CustomerStats';
import { CustomerOrders } from '@/components/admin/CustomerOrders';

export const metadata = { title: 'Admin — Customer Detail' };
export const dynamic = 'force-dynamic';

const STATUS_BADGE_CLASS: Record<string, string> = {
  New: 'badge-new',
  Active: 'badge-sale',
  Returning: 'badge-status',
  Inactive: 'badge-out',
};

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="admin-page-head">
        <div>
          <h1 style={{ marginBottom: 4 }}>{customer.name}</h1>
          <span className={`badge ${STATUS_BADGE_CLASS[customer.status]}`}>{customer.status}</span>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head">
          <h2>Customer Information</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: 14 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Email
            </div>
            {customer.email}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Phone
            </div>
            {customer.phone || '—'}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Registered
            </div>
            {new Date(customer.registeredAt).toLocaleDateString('en-EG', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <CustomerStats stats={customer.stats} />
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Order History</h2>
        </div>
        <CustomerOrders orders={customer.orders} />
      </div>
    </div>
  );
}
