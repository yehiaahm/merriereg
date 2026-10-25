import Link from 'next/link';

export default function AdminOrderNotFound() {
  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Order not found</h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20 }}>
        This order link is invalid, or the order has been deleted. Notifications for removed orders can no longer be
        opened.
      </p>
      <Link href="/admin/orders" className="btn btn-primary">
        Go to all orders
      </Link>
    </div>
  );
}
