import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCart } from '@/lib/cart';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { checkoutSchema } from '@/lib/validation';
import { createOrderFromCart, CheckoutError } from '@/lib/orders';
import { createPaymobPaymentUrl, isPaymobConfigured } from '@/lib/payment/paymob';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const input = parsed.data;

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

  let order;
  try {
    order = await createOrderFromCart(cart, input, customer?.id);
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('Checkout failed', err);
    return NextResponse.json({ error: 'Something went wrong placing your order. Please try again.' }, { status: 500 });
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
          street: input.shippingStreet,
          city: input.shippingCity,
          country: 'EG',
          apartment: input.shippingApartment || 'NA',
          building: input.shippingBuilding,
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
