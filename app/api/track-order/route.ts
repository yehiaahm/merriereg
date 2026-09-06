import { NextRequest, NextResponse } from 'next/server';
import { trackOrderSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // generateOrderNumber() (lib/orders.ts) only carries ~4 digits of
  // randomness per day, so this lookup is brute-forceable without a tight
  // per-IP limit — tighter than login's, since there's no account lockout
  // signal to fall back on here.
  if (!rateLimit(req, 'track-order', 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = trackOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid order number and phone number.' }, { status: 400 });
  }
  const { orderNumber, phone } = parsed.data;

  const order = await prisma.order.findFirst({
    where: { orderNumber: { equals: orderNumber, mode: 'insensitive' }, customerPhone: phone },
    include: { items: true },
  });

  // Same generic message whether the order number or the phone was wrong,
  // so this endpoint can't be used to test which half of the pair is right.
  if (!order) {
    return NextResponse.json({ error: "We couldn't find an order with that number and phone." }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingGovernorate: order.shippingGovernorate,
    shippingCity: order.shippingCity,
    shippingArea: order.shippingArea,
    shippingStreet: order.shippingStreet,
    shippingBuilding: order.shippingBuilding,
    shippingApartment: order.shippingApartment,
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
  });
}
