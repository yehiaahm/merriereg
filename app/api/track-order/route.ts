import { NextRequest, NextResponse } from 'next/server';
import { trackOrderSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentCustomer } from '@/lib/customer-auth';
import type { Order, OrderItem } from '@prisma/client';

function serializeOrder(order: Order & { items: OrderItem[] }) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingGovernorate: order.shippingGovernorate,
    shippingArea: order.shippingArea,
    shippingStreet: order.shippingStreet,
    shippingBuilding: order.shippingBuilding,
    shippingApartment: order.shippingApartment,
    deliveryAddress: order.deliveryAddress,
    hasDeliveryLocation: order.deliveryLat !== null && order.deliveryLng !== null,
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
    return NextResponse.json({ orders: [serializeOrder(order)], moreOrdersAvailable: false });
  }

  // Path 2: phone number only — the convenient path, with no order number
  // required. To stop a phone number alone from exposing someone's complete
  // order history (see requirement 20), this only ever returns:
  //   - every order, if the requester is already logged into the matching
  //     account (reusing the existing password-protected session — no new
  //     verification infrastructure needed), or
  //   - otherwise just the single most recent order for that phone, with a
  //     nudge to sign in for the rest.
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
    return NextResponse.json({ orders: orders.map(serializeOrder), moreOrdersAvailable: false });
  }

  const [mostRecent, total] = await Promise.all([
    prisma.order.findFirst({ where: { customerPhone: phone }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
    prisma.order.count({ where: { customerPhone: phone } }),
  ]);

  if (!mostRecent) {
    return NextResponse.json({ error: "We couldn't find any orders for that phone number." }, { status: 404 });
  }

  return NextResponse.json({
    orders: [serializeOrder(mostRecent)],
    moreOrdersAvailable: total > 1,
  });
}
