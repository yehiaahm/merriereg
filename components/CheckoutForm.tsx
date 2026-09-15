'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { SHIPPING_ZONES, calculateShippingCost } from '@/lib/shipping';
import { calculateCartDiscount } from '@/lib/promotions';
import { DeliveryLocationPicker } from '@/components/DeliveryLocationPicker';

type CartItem = {
  id: string;
  quantity: number;
  variant: {
    price: number;
    size: string;
    color: string;
    product: { name: string; images: { url: string }[]; category: { slug: string } | null };
  };
};

export function CheckoutForm({
  items,
  subtotal,
  paymobEnabled,
  customer,
}: {
  items: CartItem[];
  subtotal: number;
  paymobEnabled: boolean;
  customer: { name: string; email: string; phone: string | null } | null;
}) {
  const router = useRouter();
  const [governorate, setGovernorate] = useState('Cairo');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PAYMOB_CARD'>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const shippingEstimate = useMemo(() => calculateShippingCost(governorate), [governorate]);
  const discount = useMemo(
    () =>
      calculateCartDiscount(
        items.map((item) => ({
          price: item.variant.price,
          quantity: item.quantity,
          categorySlug: item.variant.product.category?.slug ?? null,
        })),
        couponCode
      ),
    [items, couponCode]
  );
  const couponEntered = couponCode.trim().length > 0;
  const bundleMessage = discount.bundleGroups.length > 0 ? discount.bundleGroups.map((g) => g.label).join(' + ') : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const deliveryLat = formData.get('deliveryLat');
    const deliveryLng = formData.get('deliveryLng');
    const payload = {
      customerName: String(formData.get('customerName') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      customerEmail: String(formData.get('customerEmail') ?? ''),
      shippingGovernorate: governorate,
      shippingArea: String(formData.get('shippingArea') ?? ''),
      shippingStreet: String(formData.get('shippingStreet') ?? ''),
      shippingBuilding: String(formData.get('shippingBuilding') ?? ''),
      shippingApartment: String(formData.get('shippingApartment') ?? ''),
      shippingNotes: String(formData.get('shippingNotes') ?? ''),
      deliveryLat: deliveryLat ? Number(deliveryLat) : undefined,
      deliveryLng: deliveryLng ? Number(deliveryLng) : undefined,
      deliveryAddress: String(formData.get('deliveryAddress') ?? ''),
      paymentMethod,
      couponCode,
    };

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Could not place your order.');
        setSubmitting(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setFormError('Network error — please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 48 }} className="product-detail-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <legend style={{ fontFamily: 'var(--display)', fontSize: 22, marginBottom: 8 }}>Contact</legend>
          {!customer && (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
              Checking out as a guest.{' '}
              <Link href="/account/login?next=/checkout" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                Sign in
              </Link>{' '}
              or{' '}
              <Link href="/account/signup?next=/checkout" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                create an account
              </Link>{' '}
              to track this order — or just continue below.
            </p>
          )}
          <div className="field">
            <label htmlFor="customerName">Full name</label>
            <input id="customerName" name="customerName" required minLength={2} defaultValue={customer?.name} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label htmlFor="customerPhone">Phone</label>
              <input
                id="customerPhone"
                name="customerPhone"
                required
                placeholder="010xxxxxxxx"
                defaultValue={customer?.phone ?? undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="customerEmail">Email (optional)</label>
              <input id="customerEmail" name="customerEmail" type="email" defaultValue={customer?.email} />
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <legend style={{ fontFamily: 'var(--display)', fontSize: 22, marginBottom: 8 }}>Delivery Area</legend>
          <div className="field">
            <label htmlFor="shippingGovernorate">Delivery Area</label>
            <select
              id="shippingGovernorate"
              value={governorate}
              onChange={(e) => setGovernorate(e.target.value)}
            >
              {SHIPPING_ZONES.map((zone) => (
                <optgroup key={zone.id} label={`${zone.label} — ${formatEGP(zone.rate)}`}>
                  {zone.locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </fieldset>

        <DeliveryLocationPicker />

        <div className="field">
          <label htmlFor="shippingNotes">Delivery notes (optional)</label>
          <textarea id="shippingNotes" name="shippingNotes" rows={2} />
        </div>

        <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <legend style={{ fontFamily: 'var(--display)', fontSize: 22, marginBottom: 8 }}>Payment</legend>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid var(--line)',
              padding: 14,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="paymentMethodRadio"
              checked={paymentMethod === 'COD'}
              onChange={() => setPaymentMethod('COD')}
            />
            Cash on Delivery
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid var(--line)',
              padding: 14,
              cursor: paymobEnabled ? 'pointer' : 'not-allowed',
              opacity: paymobEnabled ? 1 : 0.5,
            }}
          >
            <input
              type="radio"
              name="paymentMethodRadio"
              disabled={!paymobEnabled}
              checked={paymentMethod === 'PAYMOB_CARD'}
              onChange={() => setPaymentMethod('PAYMOB_CARD')}
            />
            Pay Online (Card / Apple Pay){!paymobEnabled && ' — coming soon'}
          </label>
        </fieldset>
      </div>

      <div>
        <div style={{ border: '1px solid var(--line)', padding: 24, background: 'var(--cream-2)', position: 'sticky', top: 90 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Order Summary</h2>
          {bundleMessage && (
            <div
              style={{
                background: 'var(--accent)',
                color: 'var(--cream)',
                padding: '10px 12px',
                marginBottom: 12,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              🎉 {bundleMessage}
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span>
                {item.variant.product.name} ({item.variant.color}/{item.variant.size}) &times; {item.quantity}
              </span>
              <span>{formatEGP(item.variant.price * item.quantity)}</span>
            </div>
          ))}
          <div className="field" style={{ marginBottom: 4 }}>
            <label htmlFor="couponCode">Promo code (optional)</label>
            <input
              id="couponCode"
              name="couponCodeInput"
              placeholder="e.g. FOLLOW10"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              style={{ textTransform: 'uppercase' }}
            />
            {couponEntered && (
              <p
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  color: discount.couponApplied ? 'var(--accent)' : 'var(--danger)',
                }}
              >
                {discount.couponApplied ? "10% follower discount applied." : 'Code not recognized.'}
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Subtotal</span>
              <span>{formatEGP(subtotal)}</span>
            </div>
            {discount.bundleGroups.map((g) => (
              <div key={g.categorySlug} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--accent)' }}>
                <span>{g.label}</span>
                <span>-{formatEGP(g.amount)}</span>
              </div>
            ))}
            {discount.couponApplied && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--accent)' }}>
                <span>Follower discount (10%)</span>
                <span>-{formatEGP(discount.couponAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Shipping (est.)</span>
              <span>{formatEGP(shippingEstimate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginTop: 8 }}>
              <span>Total (est.)</span>
              <span>{formatEGP(discount.total + shippingEstimate)}</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
              Final total is confirmed by the server on submit.
            </p>
          </div>

          {formError && (
            <p className="field-error" style={{ marginTop: 12 }}>
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={submitting}>
            {submitting ? 'Placing Order…' : 'Place Order'}
          </button>
        </div>
      </div>
    </form>
  );
}
