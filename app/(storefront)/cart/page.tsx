import Link from 'next/link';
import { getCurrentCart, cartTotals } from '@/lib/cart';
import { formatEGP } from '@/lib/money';
import { tierDiscountDetailed, formatFreeItemsMessage } from '@/lib/promotions';
import { CartItemRow } from '@/components/CartItemRow';

export const metadata = { title: 'Your Cart' };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await getCurrentCart();
  const items = cart?.items ?? [];
  const { subtotal } = cartTotals({ items });
  const tier = tierDiscountDetailed(
    items.map((item) => ({
      id: item.id,
      name: item.variant.product.name,
      price: item.variant.price,
      quantity: item.quantity,
    }))
  );
  const freeMessage = formatFreeItemsMessage(tier);
  const freeCountByItemId = new Map(tier.freeGroups.map((g) => [g.id, g.count]));

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
            {freeMessage && (
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
                🎉 {freeMessage}
              </div>
            )}
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} freeCount={freeCountByItemId.get(item.id) ?? 0} />
            ))}
          </div>
          <div>
            <div style={{ border: '1px solid var(--line)', padding: 24, background: 'var(--cream-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 700 }}>{formatEGP(subtotal)}</span>
              </div>
              {tier.amount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    color: 'var(--accent)',
                  }}
                >
                  <span>
                    {tier.freeCount} free item{tier.freeCount > 1 ? 's' : ''} ({tier.label})
                  </span>
                  <span style={{ fontWeight: 700 }}>-{formatEGP(tier.amount)}</span>
                </div>
              )}
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
