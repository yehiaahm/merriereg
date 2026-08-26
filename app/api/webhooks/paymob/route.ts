import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPaymobHmac } from '@/lib/payment/paymob';

/**
 * Paymob "Transaction processed" webhook.
 *
 * NOT tested against a live Paymob account (see lib/payment/paymob.ts).
 * The order is only ever marked PAID here, after HMAC verification — the
 * checkout flow never marks an order PAID by itself.
 *
 * Beyond the HMAC check, this also verifies the transaction's `order.id`
 * against the Paymob order id we registered for this specific order
 * (Order.paymobOrderId, set at checkout time) and that `amount_cents`
 * matches the order's total exactly. Both checks are load-bearing: Paymob's
 * HMAC does NOT cover `order.merchant_order_id`, so a validly-signed webhook
 * from any unrelated real transaction could otherwise be replayed with that
 * field edited to target a different order (see lib/payment/paymob.ts's
 * HMAC_FIELDS comment).
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const hmac = req.nextUrl.searchParams.get('hmac') ?? (body as { hmac?: string }).hmac;
  const transaction = (body as { obj?: Record<string, unknown> }).obj;

  if (!hmac || !transaction) {
    return NextResponse.json({ error: 'Missing transaction or hmac' }, { status: 400 });
  }

  if (!verifyPaymobHmac(transaction, hmac)) {
    console.warn('Paymob webhook rejected: HMAC mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const orderInfo = transaction.order as { id?: number; merchant_order_id?: string } | undefined;
  const orderNumber = orderInfo?.merchant_order_id;
  const paymobOrderId = Number(orderInfo?.id);
  const success = Boolean(transaction.success);
  const amountCents = Number(transaction.amount_cents);
  const reference = String(transaction.id ?? '');

  if (!orderNumber || !Number.isFinite(paymobOrderId)) {
    return NextResponse.json({ error: 'Incomplete order reference in payload' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // HMAC-signed `order.id` must match the Paymob order we actually
  // registered for this order — merchant_order_id alone is not trustworthy
  // (see file-level comment). This also rejects webhooks for orders that
  // were never sent to Paymob at all (COD/POS, or a failed registration).
  if (order.paymentMethod !== 'PAYMOB_CARD' || order.paymobOrderId !== paymobOrderId) {
    console.warn(`Paymob webhook rejected: order/paymobOrderId mismatch for order ${orderNumber}`);
    return NextResponse.json({ error: 'Order mismatch' }, { status: 403 });
  }
  if (!Number.isFinite(amountCents) || amountCents !== order.total) {
    console.warn(`Paymob webhook rejected: amount mismatch for order ${orderNumber}`);
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 403 });
  }

  // Idempotency: Paymob can redeliver the same event, and events can arrive
  // out of order. Never let a webhook undo an already-PAID order, and don't
  // reprocess a transaction id already recorded for this order.
  const alreadyRecorded = reference
    ? await prisma.payment.findFirst({ where: { orderId: order.id, reference } })
    : null;
  if (alreadyRecorded || order.paymentStatus === 'PAID') {
    return NextResponse.json({ received: true, deduped: true });
  }

  const newPaymentStatus = success ? 'PAID' : 'FAILED';

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: newPaymentStatus,
        status: success && order.status === 'PENDING' ? 'CONFIRMED' : order.status,
      },
    }),
    prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'PAYMOB_CARD',
        status: newPaymentStatus,
        amount: order.total,
        reference,
        rawPayload: JSON.stringify(transaction),
      },
    }),
  ]);

  return NextResponse.json({ received: true });
}
