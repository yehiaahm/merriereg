import { NextRequest, NextResponse } from 'next/server';
import { trackOrderSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentCustomer } from '@/lib/customer-auth';
import type { Order, OrderItem } from '@prisma/client';

/**
 * `redact: true` is used for anonymous lookups (order number + phone are the
 * only proof of ownership there, and both are guessable/non-secret): it never
 * returns the street-level address or the customer's full name. The signed-in
 * owner gets the full record.
 */
function serializeOrder(order: Order & { items: OrderItem[] }, redact = false) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: redact ? order.customerName.split(' ')[0] : order.customerName,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingGovernorate: order.shippingGovernorate,
    shippingArea: redact ? null : order.shippingArea,
    shippingStreet: redact ? null : order.shippingStreet,
    shippingBuilding: redact ? null : order.shippingBuilding,
    shippingApartment: redact ? null : order.shippingApartment,
    deliveryAddress: redact ? null : order.deliveryAddress,
    hasDeliveryLocation: !redact && order.deliveryLat !== null && order.deliveryLng !== null,
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    discount: order.discount,
    total: order.total,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantColor: item.variantColor,
      variantSize: item.variantSize,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = trackOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
  }
  const { orderNumber, phone } = parsed.data;

  // Path 1: order number + phone — an exact, single-order lookup. Both
  // values must match, so this can't be used to enumerate a phone number's
  // full order history — kept for anyone who still has their order number.
  if (orderNumber) {
    // generateOrderNumber() (lib/orders.ts) only carries ~4 digits of
    // randomness per day, so this lookup is brute-forceable without a tight
    // per-IP limit — tighter than login's, since there's no account lockout
    // signal to fall back on here.
    if (!rateLimit(req, 'track-order', 8, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: 'insensitive' }, customerPhone: phone },
      include: { items: true },
    });

    // Same generic message whether the order number or the phone was wrong,
    // so this endpoint can't be used to test which half of the pair is right.
    if (!order) {
      return NextResponse.json({ error: "We couldn't find an order with that number and phone." }, { status: 404 });
    }
    const owner = await getCurrentCustomer();
    const isOwner = !!owner && order.customerId === owner.id;
    return NextResponse.json({ orders: [serializeOrder(order, !isOwner)], moreOrdersAvailable: false });
  }

  // Path 2: phone number only. Only a signed-in customer whose account phone
  // matches gets their order history; anonymous callers are refused (below).
  if (!rateLimit(req, 'track-order-phone', 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const customer = await getCurrentCustomer();
  const isOwnPhone = !!customer?.phone && customer.phone === phone;

  if (isOwnPhone) {
    const orders = await prisma.order.findMany({
      where: { customerId: customer!.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    if (orders.length === 0) {
      return NextResponse.json({ error: "We couldn't find any orders for that phone number." }, { status: 404 });
    }
    return NextResponse.json({ orders: orders.map((o) => serializeOrder(o)), moreOrdersAvailable: false });
  }

  // Anonymous phone-only lookups are not offered: a phone number is not a
  // secret, so returning any order data for it would leak customers' details
  // to anyone who knows (or guesses) the number.
  return NextResponse.json(
    { error: 'Enter your order number too, or sign in to see your orders.' },
    { status: 400 }
  );
}
