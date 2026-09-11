import Link from 'next/link';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { TrackOrderForm } from '@/components/TrackOrderForm';

export const metadata = { title: 'Track Order' };
export const dynamic = 'force-dynamic';

export default async function TrackOrderPage() {
  const customer = await getCurrentCustomer();

  return (
    <main className="container" style={{ padding: '48px 24px 100px', maxWidth: 780, margin: '0 auto' }}>
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Track Order</span>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', margin: '8px 0 24px' }}>Find your order</h1>

      {customer && (
        <div style={{ background: 'var(--cream-2)', border: '1px solid var(--line)', padding: 16, marginBottom: 24, fontSize: 13, maxWidth: 380 }}>
          You&apos;re signed in as {customer.name}.{' '}
          <Link href="/account" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            View your full order history
          </Link>
          , or track a specific order by phone number below.
        </div>
      )}

      <TrackOrderForm />

      <div style={{ marginTop: 40 }}>
        <Link href="/products" className="btn btn-outline">
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
