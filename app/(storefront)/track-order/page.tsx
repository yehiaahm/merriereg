'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatEGP } from '@/lib/money';

// Mirrors lib/orders.ts's ORDER_STATUS_STEPS — kept as a plain literal here
// (not imported) because that module pulls in Prisma and other server-only
// code that can't be bundled into this client component.
const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

type TrackedItem = {
  id: string;
  productName: string;
  variantColor: string;
  variantSize: string;
  quantity: number;
  subtotal: number;
};

type TrackedOrder = {
  orderNumber: string;
  status: string;
  customerName: string;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingGovernorate: string;
  shippingCity: string;
  shippingArea: string;
  shippingStreet: string;
  shippingBuilding: string;
  shippingApartment: string | null;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  items: TrackedItem[];
};

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOrder(null);

    const res = await fetch('/api/track-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, phone }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setOrder(data);
  }

  const isCancelled = order?.status === 'CANCELLED';
  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]) : -1;

  return (
    <main className="container" style={{ padding: '48px 24px 100px', maxWidth: 780, margin: '0 auto' }}>
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Track Order</span>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', margin: '8px 0 24px' }}>Find your order</h1>

      <form onSubmit={handleSubmit} className="field" style={{ maxWidth: 380 }}>
        <label htmlFor="orderNumber">Order Number</label>
        <input
          id="orderNumber"
          type="text"
          placeholder="e.g. MR260906-1234"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          required
          autoFocus
        />
        <label htmlFor="phone" style={{ marginTop: 12 }}>
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="01xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Searching…' : 'Track Order'}
        </button>
      </form>

      {order && (
        <div style={{ marginTop: 48, borderTop: '1px solid var(--line)', paddingTop: 32 }}>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>Order #{order.orderNumber}</p>

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
          {isCancelled && (
            <p className="badge badge-status" style={{ marginBottom: 24 }}>
              CANCELLED
            </p>
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
            <div
              key={item.id}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}
            >
              <span>
                {item.productName} ({item.variantColor}/{item.variantSize}) &times; {item.quantity}
              </span>
              <span>{formatEGP(item.subtotal)}</span>
            </div>
          ))}

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div>Subtotal: {formatEGP(order.subtotal)}</div>
            <div>Shipping: {formatEGP(order.shippingCost)}</div>
            {order.discount > 0 && <div>Discount: -{formatEGP(order.discount)}</div>}
            <div style={{ fontWeight: 700, fontSize: 18 }}>Total: {formatEGP(order.total)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <Link href="/products" className="btn btn-outline">
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
