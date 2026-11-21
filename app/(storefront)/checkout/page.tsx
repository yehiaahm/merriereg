import { redirect } from 'next/navigation';
import { getCurrentCart, cartTotals } from '@/lib/cart';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { isPaymobConfigured } from '@/lib/payment/paymob';
import { CheckoutForm } from '@/components/CheckoutForm';
import { listCheckoutOffers } from '@/lib/discount-codes';
import { MetaEvent } from '@/components/MetaEvent';
import { piastresToEgp } from '@/lib/money';

export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cart, customer, offers] = await Promise.all([getCurrentCart(), getCurrentCustomer(), listCheckoutOffers()]);
  const items = cart?.items ?? [];

  if (items.length === 0) {
    redirect('/cart');
  }

  const { subtotal, itemCount } = cartTotals({ items });

  return (
    <main className="container" style={{ padding: '48px 24px 100px' }}>
      <MetaEvent
        event="InitiateCheckout"
        params={{
          content_type: 'product',
          content_ids: items.map((i) => i.variant.sku),
          contents: items.map((i) => ({ id: i.variant.sku, quantity: i.quantity, item_price: piastresToEgp(i.variant.price) })),
          num_items: itemCount,
          value: piastresToEgp(subtotal),
          currency: 'EGP',
        }}
      />
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginBottom: 32 }}>Checkout</h1>
      <CheckoutForm
        items={items}
        subtotal={subtotal}
        paymobEnabled={isPaymobConfigured()}
        offers={offers}
        customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null}
      />
    </main>
  );
}
