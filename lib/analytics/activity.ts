import { prisma } from '@/lib/prisma';

export type ActivityKind = 'order_placed' | 'refund' | 'new_customer' | 'product_updated';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  at: Date;
  href: string | null;
}

/**
 * A merged, real-data activity feed for the dashboard overview — no
 * dedicated audit-log table exists in the schema, so this composes from the
 * timestamped rows that already carry meaningful signal: new orders, refund
 * payments, new customer signups, and product edits. Nothing here is
 * synthesized; each event links back to the row that produced it.
 */
export async function getRecentActivity(limit = 12): Promise<ActivityEvent[]> {
  const perSourceLimit = limit;

  const [orders, refunds, customers, products] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: perSourceLimit,
      select: { id: true, orderNumber: true, customerName: true, total: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { status: 'REFUNDED' },
      orderBy: { createdAt: 'desc' },
      take: perSourceLimit,
      select: { id: true, createdAt: true, order: { select: { id: true, orderNumber: true } } },
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: perSourceLimit,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.product.findMany({
      orderBy: { updatedAt: 'desc' },
      take: perSourceLimit,
      select: { id: true, name: true, updatedAt: true, createdAt: true },
    }),
  ]);

  const events: ActivityEvent[] = [
    ...orders.map((o) => ({
      id: `order:${o.id}`,
      kind: 'order_placed' as const,
      message: `New order ${o.orderNumber} from ${o.customerName}`,
      at: o.createdAt,
      href: `/admin/orders/${o.id}`,
    })),
    ...refunds.map((p) => ({
      id: `refund:${p.id}`,
      kind: 'refund' as const,
      message: `Order ${p.order.orderNumber} refunded`,
      at: p.createdAt,
      href: `/admin/orders/${p.order.id}`,
    })),
    ...customers.map((c) => ({
      id: `customer:${c.id}`,
      kind: 'new_customer' as const,
      message: `${c.name} created an account`,
      at: c.createdAt,
      href: `/admin/customers/${c.id}`,
    })),
    ...products.map((p) => ({
      id: `product:${p.id}`,
      kind: 'product_updated' as const,
      message: p.updatedAt.getTime() === p.createdAt.getTime() ? `Product "${p.name}" created` : `Product "${p.name}" updated`,
      at: p.updatedAt,
      href: `/admin/products/${p.id}`,
    })),
  ];

  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
