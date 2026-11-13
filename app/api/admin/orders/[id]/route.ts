import { after, NextRequest, NextResponse } from 'next/server';
import { flushPostHogLogs, posthogLogger, SeverityNumber } from '@/instrumentation';
import { prisma } from '@/lib/prisma';
import { orderStatusUpdateSchema } from '@/lib/validation';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { releaseDiscountCode } from '@/lib/discount-codes';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher — this second check is
// defense in depth in case that matcher is ever narrowed (see lib/pos.ts's
// route for the same reasoning).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

class StaleOrderError extends Error {}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = orderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const nextStatus = parsed.data.status;

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (nextStatus === order.status) {
    return NextResponse.json({ order });
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      { error: `Cannot move an order from ${order.status} to ${nextStatus}.` },
      { status: 409 }
    );
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Compare-and-set on the status we validated against: if another request
      // changed it in the meantime, nothing below runs (no double restock / coupon
      // release from two concurrent cancellations).
      const claimed = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: nextStatus },
      });
      if (claimed.count === 0) throw new StaleOrderError();

      if (nextStatus === 'CANCELLED' || nextStatus === 'RETURNED') {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }

      // A cancelled order never happened, so its promo-code use goes back to the
      // code's usage limit. (Returned orders keep theirs — the sale did occur.)
      if (nextStatus === 'CANCELLED') {
        await releaseDiscountCode(tx, order.couponCode);
      }

      if (nextStatus === 'RETURNED') {
        return tx.order.update({
          where: { id },
          data: {
            paymentStatus: 'REFUNDED',
            payments: {
              create: {
                provider: order.paymentMethod,
                status: 'REFUNDED',
                // Negative amount marks this as money paid back out, distinct
                // from the original positive-amount payment record.
                amount: -order.total,
              },
            },
          },
        });
      }

      return tx.order.findUniqueOrThrow({ where: { id } });
    });
  } catch (err) {
    if (err instanceof StaleOrderError) {
      return NextResponse.json({ error: 'This order was just updated by someone else. Reload and try again.' }, { status: 409 });
    }
    throw err;
  }

  posthogLogger?.emit({
    body: 'admin_order_status_updated',
    severityNumber: SeverityNumber.INFO,
    attributes: {
      previous_status: order.status,
      next_status: nextStatus,
      payment_method: order.paymentMethod,
    },
  });
  after(flushPostHogLogs);

  return NextResponse.json({ order: updated });
}
