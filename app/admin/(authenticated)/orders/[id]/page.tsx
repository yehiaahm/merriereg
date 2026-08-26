import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import { OrderStatusUpdater } from '@/components/admin/OrderStatusUpdater';

export const metadata = { title: 'Admin — Order Detail' };
export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
  });

  if (!order) notFound();

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 26 }}>Order {order.orderNumber}</h1>
        <span className="badge badge-status">{order.status}</span>
      </div>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 24, fontSize: 13 }}>
        Placed {order.createdAt.toLocaleString('en-EG')}
      </p>

      <div style={{ marginBottom: 24 }}>
        <OrderStatusUpdater orderId={order.id} status={order.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ border: '1px solid var(--line)', padding: 16 }}>
          <span className="eyebrow">Customer</span>
          <p style={{ margin: '6px 0 2px' }}>{order.customerName}</p>
          <p style={{ margin: '2px 0', fontSize: 13, color: 'var(--ink-soft)' }}>{order.customerPhone}</p>
          <p style={{ margin: '2px 0', fontSize: 13, color: 'var(--ink-soft)' }}>{order.customerEmail || '—'}</p>
        </div>
        <div style={{ border: '1px solid var(--line)', padding: 16 }}>
          <span className="eyebrow">Delivery Address</span>
          <p style={{ margin: '6px 0', fontSize: 14 }}>
            {order.shippingStreet}, {order.shippingBuilding}
            {order.shippingApartment ? `, Apt ${order.shippingApartment}` : ''}
            <br />
            {order.shippingArea}, {order.shippingCity}, {order.shippingGovernorate}
          </p>
          {order.shippingNotes && <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Notes: {order.shippingNotes}</p>}
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', padding: 16, marginBottom: 28 }}>
        <span className="eyebrow">Payment</span>
        <p style={{ margin: '6px 0' }}>
          Method: <strong>{order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</strong> — Status:{' '}
          <strong>{order.paymentStatus}</strong>
        </p>
        {order.payments.map((p) => (
          <div key={p.id} style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {p.createdAt.toLocaleString('en-EG')} — {p.status} {p.reference ? `(ref: ${p.reference})` : ''}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Items</h2>
      <div className="admin-table-scroll" style={{ marginBottom: 24 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Variant</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.productName}</td>
              <td>
                {item.variantColor} / {item.variantSize}
              </td>
              <td>{item.sku}</td>
              <td>{item.quantity}</td>
              <td>{formatEGP(item.unitPrice)}</td>
              <td>{formatEGP(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div>Subtotal: {formatEGP(order.subtotal)}</div>
        <div>Shipping: {formatEGP(order.shippingCost)}</div>
        {order.discount > 0 && (
          <div>
            Discount: -{formatEGP(order.discount)}
            {order.couponCode && ` (code: ${order.couponCode})`}
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 18 }}>Total: {formatEGP(order.total)}</div>
      </div>
    </div>
  );
}
