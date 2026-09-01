import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { EmptyState } from './EmptyState';

export interface RecentOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: Date;
}

export function RecentOrders({ orders }: { orders: RecentOrderRow[] }) {
  if (orders.length === 0) {
    return <EmptyState title="No orders yet" message="New orders will show up here as they come in." />;
  }

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.orderNumber}</td>
              <td>{o.customerName}</td>
              <td>{formatEGP(o.total)}</td>
              <td>
                <span className="badge badge-status">{o.status}</span>
              </td>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-soft)', fontSize: 12 }}>
                {o.createdAt.toLocaleDateString('en-EG', { month: 'short', day: 'numeric' })}
              </td>
              <td>
                <Link href={`/admin/orders/${o.id}`} style={{ fontSize: 12, fontWeight: 700 }}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
