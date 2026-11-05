'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { SHIPPING_ZONES, calculateShippingCost } from '@/lib/shipping';
import { calculateCartDiscount, describeDiscountRule, type DiscountRule } from '@/lib/promotions';
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

export type CheckoutOffer = { rule: DiscountRule; label: string };

export function CheckoutForm({
  items,
  subtotal,
  paymobEnabled,
  offers,
  customer,
}: {
  items: CartItem[];
  subtotal: number;
  paymobEnabled: boolean;
  offers: CheckoutOffer[];
  customer: { name: string; email: string; phone: string | null } | null;
}) {
  const router = useRouter();
  const [governorate, setGovernorate] = useState('Cairo');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PAYMOB_CARD'>('COD');
  // The code currently applied to this order (null = none). Offers carry their
  // rule so they apply instantly; typed codes are checked by the server first.
  const [appliedRule, setAppliedRule] = useState<DiscountRule | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
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
        appliedRule
      ),
    [items, appliedRule]
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context): fall back to a hidden textarea.
      const el = document.createElement('textarea');
      el.value = code;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(el);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1800);
  }
  const bundleMessage = discount.bundleGroups.length > 0 ? discount.bundleGroups.map((g) => g.label).join(' + ') : null;

  function applyOffer(rule: DiscountRule) {
    setAppliedRule(rule);
    setCodeInput('');
    setCodeError(null);
  }

  function removeCode() {
    setAppliedRule(null);
    setCodeError(null);
  }

  async function applyTypedCode() {
    const code = codeInput.trim();
    if (!code || checkingCode) return;
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.valid && data.rule) {
        setAppliedRule(data.rule as DiscountRule);
        setCodeInput('');
      } else {
        setCodeError(data.message ?? 'Code not recognized.');
      }
    } catch {
      setCodeError('Network error — please try again.');
    } finally {
      setCheckingCode(false);
    }
  }

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
      couponCode: discount.couponApplied && appliedRule ? appliedRule.code : '',
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
          {offers.length > 0 && (
            <div style={{ border: '1px dashed var(--accent)', padding: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🎁 Discount codes available</div>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 10px' }}>
                Use one code per order — copy it or apply it instantly.
              </p>
              {offers.map(({ rule, label }) => {
                const isApplied = appliedRule?.code === rule.code && discount.couponApplied;
                const belowMinimum = discount.subtotal - discount.bundleAmount < rule.minSubtotal;
                return (
                  <div
                    key={rule.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                      padding: '8px 0',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, letterSpacing: 0.5 }}>{rule.code}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        {label} · {describeDiscountRule(rule)}
                        {rule.minSubtotal > 0 && ` · min. order ${formatEGP(rule.minSubtotal)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => copyCode(rule.code)}
                      >
                        {copiedCode === rule.code ? 'Copied ✓' : 'Copy'}
                      </button>
                      {isApplied ? (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={removeCode}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          disabled={belowMinimum}
                          title={belowMinimum ? `Spend at least ${formatEGP(rule.minSubtotal)} to use this code.` : undefined}
                          onClick={() => applyOffer(rule)}
                        >
                          Apply discount
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="field" style={{ marginBottom: 4 }}>
            <label htmlFor="couponCode">Promo code (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="couponCode"
                name="couponCodeInput"
                placeholder="Enter promo code"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  // Enter applies the code instead of submitting the whole order form.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyTypedCode();
                  }
                }}
                autoComplete="off"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '0 16px', fontSize: 13 }}
                disabled={checkingCode || codeInput.trim().length === 0}
                onClick={applyTypedCode}
              >
                {checkingCode ? 'Checking…' : 'Apply'}
              </button>
            </div>
            {codeError && (
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--danger)' }} role="alert">
                {codeError}
              </p>
            )}
            {appliedRule && discount.couponApplied && (
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--accent)' }}>
                Code {appliedRule.code} applied — {describeDiscountRule(appliedRule)}.{' '}
                <button
                  type="button"
                  onClick={removeCode}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                >
                  Remove
                </button>
              </p>
            )}
            {appliedRule && !discount.couponApplied && (
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--danger)' }}>
                Spend at least {formatEGP(appliedRule.minSubtotal)} to use code {appliedRule.code}.
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
                <span>Discount code ({appliedRule?.code})</span>
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
