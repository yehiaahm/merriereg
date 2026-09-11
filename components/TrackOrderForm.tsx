'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { OrderStatusTimeline } from '@/components/OrderStatusTimeline';

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
  shippingArea: string | null;
  shippingStreet: string | null;
  shippingBuilding: string | null;
  shippingApartment: string | null;
  deliveryAddress: string | null;
  hasDeliveryLocation: boolean;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  items: TrackedItem[];
};

export function TrackOrderForm() {
  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [showOrderNumber, setShowOrderNumber] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
  const [moreOrdersAvailable, setMoreOrdersAvailable] = useState(false);
  const [selected, setSelected] = useState<TrackedOrder | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOrders(null);
    setSelected(null);

    const res = await fetch('/api/track-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, orderNumber: showOrderNumber ? orderNumber : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setOrders(data.orders);
    setMoreOrdersAvailable(data.moreOrdersAvailable);
    if (data.orders?.length === 1) setSelected(data.orders[0]);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="field" style={{ maxWidth: 380 }}>
        <label htmlFor="phone">Phone Number</label>
        <input
          id="phone"
          type="tel"
          placeholder="+20 xxx xxx xxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoFocus
        />
        {showOrderNumber ? (
          <>
            <label htmlFor="orderNumber" style={{ marginTop: 12 }}>
              Order Number
            </label>
            <input
              id="orderNumber"
              type="text"
              placeholder="e.g. MR260906-1234"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowOrderNumber(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              marginTop: 10,
              color: 'var(--ink-soft)',
              textDecoration: 'underline',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
              width: 'fit-content',
            }}
          >
            Have your order number too?
          </button>
        )}
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Searching…' : 'Track My Orders'}
        </button>
      </form>

      {orders && orders.length > 0 && !selected && (
        <div style={{ marginTop: 48, borderTop: '1px solid var(--line)', paddingTop: 32 }}>
          <span className="eyebrow">My Orders</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            {orders.map((order) => (
              <div key={order.orderNumber} style={{ border: '1px solid var(--line)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <span>
                    <span style={{ fontWeight: 700 }}>#{order.orderNumber}</span>
                    <br />
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {new Date(order.createdAt).toLocaleDateString('en-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
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
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ marginTop: 12, minHeight: 36, padding: '0 14px' }}
                  onClick={() => setSelected(order)}
                >
                  View Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 48, borderTop: '1px solid var(--line)', paddingTop: 32 }}>
          {orders && orders.length > 1 && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginBottom: 16,
                color: 'var(--ink-soft)',
                textDecoration: 'underline',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ← Back to my orders
            </button>
          )}
          <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>Order #{selected.orderNumber}</p>

          <OrderStatusTimeline status={selected.status} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div style={{ border: '1px solid var(--line)', padding: 18 }}>
              <span className="eyebrow">Payment</span>
              <p style={{ marginTop: 6 }}>
                {selected.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'} —{' '}
                <strong>{selected.paymentStatus}</strong>
              </p>
            </div>
            <div style={{ border: '1px solid var(--line)', padding: 18 }}>
              <span className="eyebrow">Delivery Location</span>
              <p style={{ marginTop: 6, fontSize: 14 }}>
                {selected.shippingGovernorate}
                <br />
                {selected.shippingStreet && selected.shippingBuilding ? (
                  <>
                    {selected.shippingStreet}, {selected.shippingBuilding}
                    {selected.shippingApartment ? `, Apt ${selected.shippingApartment}` : ''}
                    {selected.shippingArea ? `, ${selected.shippingArea}` : ''}
                  </>
                ) : selected.deliveryAddress ? (
                  selected.deliveryAddress
                ) : selected.hasDeliveryLocation ? (
                  'Pinned on the map at checkout.'
                ) : (
                  '—'
                )}
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Items</h2>
          {selected.items.map((item) => (
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
            <div>Subtotal: {formatEGP(selected.subtotal)}</div>
            <div>Shipping: {formatEGP(selected.shippingCost)}</div>
            {selected.discount > 0 && <div>Discount: -{formatEGP(selected.discount)}</div>}
            <div style={{ fontWeight: 700, fontSize: 18 }}>Total: {formatEGP(selected.total)}</div>
          </div>
        </div>
      )}

      {moreOrdersAvailable && (
        <div style={{ marginTop: 24, background: 'var(--cream-2)', border: '1px solid var(--line)', padding: 16, fontSize: 13 }}>
          You have more orders on file for this phone number.{' '}
          <Link href="/account/login?next=/account" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            Sign in to your account
          </Link>{' '}
          to see your full order history.
        </div>
      )}
    </>
  );
}
