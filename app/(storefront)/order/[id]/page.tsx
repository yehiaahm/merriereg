import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import { getCurrentCustomer } from '@/lib/customer-auth';

export const metadata = { title: 'Order Confirmation' };
export const dynamic = 'force-dynamic';

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paymentError?: string }>;
}) {
  const { id } = await params;
  const { paymentError } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) notFound();

  // Orders placed while signed in (or later linked to an account) belong to
  // that customer — only they may view the page, even via a direct link.
  // Guest orders (customerId null) have no account to check against, so the
  // unguessable order id remains the access control there, same as before.
  if (order.customerId) {
    const customer = await getCurrentCustomer();
    if (!customer || customer.id !== order.customerId) {
      notFound();
    }
  }

  const isCancelled = order.status === 'CANCELLED';
  const currentStepIndex = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);

  return (
    <main className="container" style={{ padding: '48px 24px 100px', maxWidth: 780, margin: '0 auto' }}>
      {paymentError && (
        <div style={{ background: '#fdecea', border: '1px solid var(--danger)', padding: 14, marginBottom: 24, fontSize: 14 }}>
          Your order was created, but we couldn&apos;t start the online payment. Please contact us or try again — your items
          are held for this order.
        </div>
      )}

      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Order Confirmed</span>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', margin: '8px 0 4px' }}>Thank you, {order.customerName.split(' ')[0]}.</h1>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 32 }}>Order #{order.orderNumber}</p>

      {!isCancelled && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {STATUS_STEPS.map((step, i) => (
            <div key={step} style={{ flex: 1 }}>
              <div
                style={{
                  height: 4,
                  background: i <= currentStepIndex ? 'var(--accent)' : 'var(--line)',
                  marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div style={{ border: '1px solid var(--line)', padding: 18 }}>
          <span className="eyebrow">Payment</span>
          <p style={{ marginTop: 6 }}>
            {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'} —{' '}
            <strong>{order.paymentStatus}</strong>
          </p>
        </div>
        <div style={{ border: '1px solid var(--line)', padding: 18 }}>
          <span className="eyebrow">Delivery Address</span>
          <p style={{ marginTop: 6, fontSize: 14 }}>
            {order.shippingStreet}, {order.shippingBuilding}
            {order.shippingApartment ? `, Apt ${order.shippingApartment}` : ''}
            <br />
            {order.shippingArea}, {order.shippingCity}, {order.shippingGovernorate}
          </p>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Items</h2>
      {order.items.map((item) => (
        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
          <span>
            {item.productName} ({item.variantColor}/{item.variantSize}) &times; {item.quantity}
          </span>
          <span>{formatEGP(item.subtotal)}</span>
        </div>
      ))}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div>Subtotal: {formatEGP(order.subtotal)}</div>
        <div>Shipping: {formatEGP(order.shippingCost)}</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Total: {formatEGP(order.total)}</div>
      </div>

      <div style={{ marginTop: 40 }}>
        <Link href="/products" className="btn btn-outline">
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
