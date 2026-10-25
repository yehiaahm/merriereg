import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import { isPushConfigured } from '@/lib/push/config';
import { deliverToAdmins, type BatchSummary, type PushPayload, type PushSender } from '@/lib/push/send';

export type NotifyOutcome =
  | 'sent' // at least one admin device accepted it
  | 'no-devices' // push configured, but no admin has enabled notifications yet
  | 'not-configured' // VAPID keys missing
  | 'duplicate' // this order was already notified (retry / webhook redelivery)
  | 'not-eligible' // not a customer order, or payment not verified yet
  | 'not-found'
  | 'delivery-failed'; // every device failed transiently; claim released so a later trigger can retry

export function orderDeepLink(orderId: string): string {
  return `/admin/orders/${encodeURIComponent(orderId)}`;
}

/**
 * Payload shown on the admin's phone. Deliberately contains only the order
 * number and total — no customer name, phone, address or items, since
 * notification text is visible on lock screens and passes through the
 * platform push service.
 */
export function buildNewOrderPayload(order: { id: string; orderNumber: string; total: number }): PushPayload {
  return {
    title: 'New Order Received!',
    body: `A new customer order has been placed.\nOrder #${order.orderNumber} · Total: ${formatEGP(order.total)}`,
    url: orderDeepLink(order.id),
    // One notification per order per device: re-delivery replaces instead of stacking.
    tag: `order-${order.id}`,
  };
}

/**
 * Notifies every registered admin device about a newly placed order.
 *
 * Call it only once an order is persisted AND counts as placed:
 *  - Cash on Delivery: right after the order is created at checkout.
 *  - Online card: only after the Paymob webhook verified payment (PAID) — an
 *    unpaid, abandoned card checkout must not ring the admin's phone.
 *  - POS sales are rung up by staff in-store, so they are not "customer orders".
 *
 * Idempotent: Order.adminNotifiedAt is claimed with a conditional UPDATE, so
 * concurrent or repeated triggers for the same order send at most one push
 * per device. Safe to run in the background — it never throws.
 */
export async function notifyAdminsOfNewOrder(
  orderId: string,
  deps: { sender?: PushSender; backoffMs?: number[] } = {}
): Promise<NotifyOutcome> {
  try {
    if (!isPushConfigured()) {
      console.info('[push] new-order notification skipped: VAPID keys are not configured');
      return 'not-configured';
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, total: true, paymentMethod: true, paymentStatus: true },
    });
    if (!order) return 'not-found';

    const isCustomerOrder = order.paymentMethod === 'COD' || order.paymentMethod === 'PAYMOB_CARD';
    const paymentVerified = order.paymentMethod !== 'PAYMOB_CARD' || order.paymentStatus === 'PAID';
    if (!isCustomerOrder || !paymentVerified) return 'not-eligible';

    // Atomic claim: only one caller can flip adminNotifiedAt from NULL.
    const claimedAt = new Date();
    const claim = await prisma.order.updateMany({
      where: { id: order.id, adminNotifiedAt: null },
      data: { adminNotifiedAt: claimedAt },
    });
    if (claim.count === 0) return 'duplicate';

    let summary: BatchSummary;
    try {
      summary = await deliverToAdmins(buildNewOrderPayload(order), deps);
    } catch (err) {
      await releaseClaim(order.id, claimedAt);
      throw err;
    }

    if (summary.total === 0) {
      console.info(`[push] order ${order.orderNumber}: no admin devices registered`);
      return 'no-devices';
    }
    if (summary.sent === 0 && summary.transientFailures > 0) {
      await releaseClaim(order.id, claimedAt);
      console.error(`[push] order ${order.orderNumber}: push services unreachable — will retry on the next trigger`);
      return 'delivery-failed';
    }

    console.info(
      `[push] order ${order.orderNumber}: delivered to ${summary.sent}/${summary.total} admin device(s)` +
        (summary.gone ? `, ${summary.gone} expired subscription(s) removed` : '')
    );
    return 'sent';
  } catch (err) {
    // The order is already saved; a notification problem must never surface to checkout.
    console.error(`[push] new-order notification for ${orderId} failed`, err);
    return 'delivery-failed';
  }
}

async function releaseClaim(orderId: string, claimedAt: Date): Promise<void> {
  await prisma.order
    .updateMany({ where: { id: orderId, adminNotifiedAt: claimedAt }, data: { adminNotifiedAt: null } })
    .catch(() => undefined);
}
