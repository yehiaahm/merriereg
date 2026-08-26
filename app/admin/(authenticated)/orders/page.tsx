import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import type { Prisma } from '@prisma/client';

export const metadata = { title: 'Admin — Orders' };
export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as Prisma.OrderWhereInput['status'];
  if (q) {
    where.OR = [
      { orderNumber: { contains: q } },
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { customerEmail: { contains: q } },
    ];
  }

  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: 'desc' } });

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Orders</h1>

      <form style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search order #, name, phone, email"
          style={{ flex: '1 1 200px', minWidth: 0, maxWidth: 320 }}
        />
        <select name="status" defaultValue={status ?? ''}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-outline">
          Filter
        </button>
      </form>

      <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Placed</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
              </td>
              <td>{o.customerName}</td>
              <td>{formatEGP(o.total)}</td>
              <td>{o.paymentStatus}</td>
              <td>
                <span className="badge badge-status">{o.status}</span>
              </td>
              <td>{o.createdAt.toLocaleString('en-EG')}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: 'var(--ink-soft)' }}>
                No orders match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
