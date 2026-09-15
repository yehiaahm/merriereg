import Link from 'next/link';
import { getCurrentCart, cartTotals } from '@/lib/cart';
import { formatEGP } from '@/lib/money';
import { bundleDiscount } from '@/lib/promotions';
import { CartItemRow } from '@/components/CartItemRow';

export const metadata = { title: 'Your Cart' };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await getCurrentCart();
  const items = cart?.items ?? [];
  const { subtotal } = cartTotals({ items });
  const bundle = bundleDiscount(
    items.map((item) => ({
      price: item.variant.price,
      quantity: item.quantity,
      categorySlug: item.variant.product.category?.slug ?? null,
    }))
  );

  return (
    <main className="container" style={{ padding: '48px 24px 100px' }}>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', marginBottom: 32 }}>Your Cart</h1>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>Your cart is empty.</p>
          <Link href="/products" className="btn btn-primary">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 48 }} className="product-detail-grid">
          <div>
            {bundle.groups.length > 0 && (
              <div
                style={{
                  background: 'var(--accent)',
                  color: 'var(--cream)',
                  padding: '12px 16px',
                  marginBottom: 16,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                🎉 {bundle.groups.map((g) => g.label).join(' + ')}
              </div>
            )}
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>
          <div>
            <div style={{ border: '1px solid var(--line)', padding: 24, background: 'var(--cream-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 700 }}>{formatEGP(subtotal)}</span>
              </div>
              {bundle.groups.map((g) => (
                <div
                  key={g.categorySlug}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    color: 'var(--accent)',
                  }}
                >
                  <span>{g.label}</span>
                  <span style={{ fontWeight: 700 }}>-{formatEGP(g.amount)}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 20 }}>
                Shipping calculated at checkout. Have a promo code? Enter it at checkout.
              </p>
              <Link href="/checkout" className="btn btn-primary" style={{ width: '100%' }}>
                Checkout
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
