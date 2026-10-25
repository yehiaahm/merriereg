import { after } from 'next/server';
import { notifyAdminsOfNewOrder } from '@/lib/push/notify-order';

/**
 * Queues the admin push for after the HTTP response has been sent, so checkout
 * never waits on (or fails because of) a push service. Falls back to a
 * detached promise if called outside a request scope.
 */
export function scheduleNewOrderNotification(orderId: string): void {
  try {
    after(async () => {
      await notifyAdminsOfNewOrder(orderId);
    });
  } catch {
    void notifyAdminsOfNewOrder(orderId);
  }
}
