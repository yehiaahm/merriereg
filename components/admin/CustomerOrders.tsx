import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { EmptyState } from './EmptyState';
import type { CustomerDetail } from '@/lib/analytics/customers';

export function CustomerOrders({ orders }: { orders: CustomerDetail['orders'] }) {
  if (orders.length === 0) {
    return <EmptyState title="No orders yet" message="This customer hasn't placed an order." />;
  }

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Items</th>
            <th>Amount</th>
            <th>Payment</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.orderNumber}</td>
              <td>{new Date(o.createdAt).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td>{o.itemCount}</td>
              <td>{formatEGP(o.total)}</td>
              <td>{o.paymentStatus}</td>
              <td>
                <span className="badge badge-status">{o.status}</span>
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
