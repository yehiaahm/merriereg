import { redirect } from 'next/navigation';
import { getCurrentCart, cartTotals } from '@/lib/cart';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { isPaymobConfigured } from '@/lib/payment/paymob';
import { CheckoutForm } from '@/components/CheckoutForm';

export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cart, customer] = await Promise.all([getCurrentCart(), getCurrentCustomer()]);
  const items = cart?.items ?? [];

  if (items.length === 0) {
    redirect('/cart');
  }

  const { subtotal } = cartTotals({ items });

  return (
    <main className="container" style={{ padding: '48px 24px 100px' }}>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginBottom: 32 }}>Checkout</h1>
      <CheckoutForm
        items={items}
        subtotal={subtotal}
        paymobEnabled={isPaymobConfigured()}
        customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null}
      />
    </main>
  );
}
