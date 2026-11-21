import { after, NextRequest, NextResponse } from 'next/server';
import { flushPostHogLogs, posthogLogger, SeverityNumber } from '@/instrumentation';
import { prisma } from '@/lib/prisma';
import { getCurrentCart } from '@/lib/cart';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { checkoutSchema } from '@/lib/validation';
import { createOrderFromCart, CheckoutError } from '@/lib/orders';
import { createPaymobPaymentUrl, isPaymobConfigured } from '@/lib/payment/paymob';
import { scheduleNewOrderNotification } from '@/lib/push/schedule';
import { clientIp, rateLimit, rateLimitKey } from '@/lib/rate-limit';
import { ATTRIBUTION_COOKIE, cleanMetaCookie, fbcFromFbclid, parseAttribution } from '@/lib/meta/attribution';
import { sendMetaPurchase, siteOrigin } from '@/lib/meta/capi';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Orders reserve stock immediately, so unthrottled checkout lets a script
  // exhaust inventory and spam admin notifications. Limit per IP and per phone.
  if (!rateLimit(req, 'checkout', 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many orders from this connection. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const input = parsed.data;

  if (!rateLimitKey('checkout-phone', input.customerPhone, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many orders for this phone number. Please try again later.' }, { status: 429 });
  }

  if (input.paymentMethod === 'PAYMOB_CARD' && !isPaymobConfigured()) {
    return NextResponse.json(
      { error: 'Online card payment is not available yet. Please choose Cash on Delivery.' },
      { status: 400 }
    );
  }

  const cart = await getCurrentCart();
  if (!cart) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }

  const customer = await getCurrentCustomer();

  // Ad attribution from first-party cookies (set by components/MetaPixel.tsx
  // and Meta's own Pixel). Untrusted browser input — parseAttribution and
  // cleanMetaCookie re-validate and length-cap every value.
  const attr = parseAttribution(req.cookies.get(ATTRIBUTION_COOKIE)?.value);
  const metaFbp = cleanMetaCookie(req.cookies.get('_fbp')?.value);
  const metaFbc =
    cleanMetaCookie(req.cookies.get('_fbc')?.value) ?? (attr?.fbclid ? fbcFromFbclid(attr.fbclid, attr.ts) : undefined);
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || undefined;

  let order;
  try {
    order = await createOrderFromCart(cart, input, customer?.id, {
      utmSource: attr?.utm_source,
      utmMedium: attr?.utm_medium,
      utmCampaign: attr?.utm_campaign,
      utmContent: attr?.utm_content,
      utmTerm: attr?.utm_term,
      fbclid: attr?.fbclid,
      metaFbp,
      metaFbc,
      // Kept for the card-payment Purchase sent later from the Paymob webhook.
      metaUserAgent: userAgent,
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('Checkout failed', err);
    return NextResponse.json({ error: 'Something went wrong placing your order. Please try again.' }, { status: 500 });
  }

  posthogLogger?.emit({
    body: 'checkout_order_created',
    severityNumber: SeverityNumber.INFO,
    attributes: {
      payment_method: input.paymentMethod,
      is_authenticated_customer: Boolean(customer),
    },
  });
  after(flushPostHogLogs);

  // Cash on Delivery is a placed order as soon as it is saved. Card orders
  // notify the admin only once Paymob's webhook confirms payment (see
  // app/api/webhooks/paymob/route.ts). Runs after the response is sent, so a
  // slow or failing push service can never delay or break checkout.
  if (input.paymentMethod === 'COD') {
    scheduleNewOrderNotification(order.id);

    // Meta Conversions API Purchase (no-op unless configured). A COD order
    // counts as a purchase once placed; card orders are sent from the Paymob
    // webhook once paid. Runs after the response — never delays checkout.
    const siteUrl = siteOrigin(req.headers);
    const placedOrder = order;
    const ip = clientIp(req);
    after(() =>
      sendMetaPurchase(placedOrder, {
        clientIp: ip,
        userAgent,
        fbp: metaFbp,
        fbc: metaFbc,
        eventSourceUrl: siteUrl ? `${siteUrl}/checkout` : undefined,
      })
    );
  }

  if (input.paymentMethod === 'PAYMOB_CARD') {
    try {
      const [firstName, ...rest] = input.customerName.trim().split(' ');
      const { url: paymentUrl, paymobOrderId } = await createPaymobPaymentUrl({
        orderNumber: order.orderNumber,
        amountPiastres: order.total,
        billingData: {
          first_name: firstName || input.customerName,
          last_name: rest.join(' ') || 'N/A',
          // Validated as present by checkoutSchema's superRefine whenever paymentMethod is PAYMOB_CARD.
          email: input.customerEmail!,
          phone_number: input.customerPhone,
          // Street/building may be blank when the customer used the map
          // location picker instead of typing a manual address — Paymob
          // requires non-empty strings, so fall back to the reverse-geocoded
          // address (or a generic placeholder) rather than the address
          // fields, which were never collected in that case.
          street: input.shippingStreet || input.deliveryAddress || 'See delivery location',
          city: input.shippingGovernorate,
          country: 'EG',
          apartment: input.shippingApartment || 'NA',
          building: input.shippingBuilding || 'N/A',
        },
      });
      // Bind this order to Paymob's numeric order id BEFORE returning the
      // payment URL to the customer — the webhook refuses to mark anything
      // paid unless this matches (see lib/payment/paymob.ts HMAC_FIELDS note).
      await prisma.order.update({ where: { id: order.id }, data: { paymobOrderId } });
      return NextResponse.json({ orderId: order.id, redirectUrl: paymentUrl });
    } catch (err) {
      console.error('Paymob payment initiation failed', err);
      // Order already exists as PENDING/unpaid — customer can retry payment
      // from the order confirmation page rather than losing the order.
      return NextResponse.json({
        orderId: order.id,
        redirectUrl: `/order/${order.id}?paymentError=1`,
      });
    }
  }

  return NextResponse.json({ orderId: order.id, redirectUrl: `/order/${order.id}` });
}
