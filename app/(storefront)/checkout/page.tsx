import { randomUUID } from 'crypto';
import { after } from 'next/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentCart, cartTotals } from '@/lib/cart';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { isPaymobConfigured } from '@/lib/payment/paymob';
import { CheckoutForm } from '@/components/CheckoutForm';
import { listCheckoutOffers } from '@/lib/discount-codes';
import { MetaEvent } from '@/components/MetaEvent';
import { piastresToEgp } from '@/lib/money';
import { ATTRIBUTION_COOKIE, parseAttribution } from '@/lib/meta/attribution';
import { isMetaCapiConfigured, sendMetaInitiateCheckout, siteOrigin } from '@/lib/meta/capi';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cart, customer, offers] = await Promise.all([getCurrentCart(), getCurrentCustomer(), listCheckoutOffers()]);
  const items = cart?.items ?? [];

  if (items.length === 0) {
    redirect('/cart');
  }

  const { subtotal, itemCount } = cartTotals({ items });

  // One id per checkout view, shared by the browser Pixel event below and the
  // server-side Conversions API event, so Meta keeps exactly one of them.
  const initiateCheckoutId = `ic_${randomUUID()}`;
  if (isMetaCapiConfigured()) {
    const [h, c] = await Promise.all([headers(), cookies()]);
    const attr = parseAttribution(c.get(ATTRIBUTION_COOKIE)?.value);
    const siteUrl = siteOrigin(h);
    const ctx = {
      clientIp: clientIpFromHeaders(h),
      userAgent: h.get('user-agent')?.slice(0, 500) || undefined,
      fbp: c.get('_fbp')?.value,
      fbc: c.get('_fbc')?.value,
      fbclid: attr?.fbclid,
      fbclidTs: attr?.ts,
      eventSourceUrl: siteUrl ? `${siteUrl}/checkout` : undefined,
    };
    const checkout = {
      eventId: initiateCheckoutId,
      items: items.map((i) => ({ sku: i.variant.sku, quantity: i.quantity, unitPrice: i.variant.price })),
      subtotal,
      customerEmail: customer?.email,
      customerPhone: customer?.phone,
    };
    // After the response: tracking never slows or breaks the checkout page.
    after(() => sendMetaInitiateCheckout(checkout, ctx));
  }

  return (
    <main className="container" style={{ padding: '48px 24px 100px' }}>
      <MetaEvent
        event="InitiateCheckout"
        eventId={initiateCheckoutId}
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
