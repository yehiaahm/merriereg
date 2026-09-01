import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type CustomerStatus = 'New' | 'Active' | 'Returning' | 'Inactive';

/**
 * A customer with no orders in the last this-many days (but at least one
 * order ever) is considered Inactive rather than Active/Returning. Shared
 * between the JS derivation below and the SQL status filter in
 * `listCustomers` so the two can never disagree.
 */
export const CUSTOMER_ACTIVE_WINDOW_DAYS = 90;

/**
 * Derives a customer's lifecycle status from their real order history —
 * never stored, always computed, so it can't go stale:
 *   - New: has never placed an order.
 *   - Active: exactly one order, placed within the active window.
 *   - Returning: two or more orders, most recent within the active window.
 *   - Inactive: has ordered before, but not within the active window.
 */
export function deriveCustomerStatus(orderCount: number, lastOrderAt: Date | null): CustomerStatus {
  if (orderCount === 0 || lastOrderAt === null) return 'New';
  const withinWindow = Date.now() - lastOrderAt.getTime() <= CUSTOMER_ACTIVE_WINDOW_DAYS * 86_400_000;
  if (!withinWindow) return 'Inactive';
  return orderCount >= 2 ? 'Returning' : 'Active';
}

export interface CustomerListRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registeredAt: Date;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: Date | null;
  status: CustomerStatus;
}

export type CustomerSort = 'registeredAt' | 'name' | 'orderCount' | 'totalSpend' | 'lastOrderAt';

const SORT_COLUMNS: Record<CustomerSort, string> = {
  registeredAt: 'registered_at',
  name: 'name',
  orderCount: 'order_count',
  totalSpend: 'total_spend',
  lastOrderAt: 'last_order_at',
};

export interface ListCustomersOptions {
  q?: string;
  status?: CustomerStatus;
  sort?: CustomerSort;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ListCustomersResult {
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Customer list with real order-derived stats (order count, total spend from
 * paid orders, last order date), search, status filter, sort and pagination
 * all computed at the database level via one aggregating query — avoids
 * pulling every customer's full order history into Node just to sort/filter
 * a page of results.
 */
export async function listCustomers(options: ListCustomersOptions = {}): Promise<ListCustomersResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const sortColumn = SORT_COLUMNS[options.sort ?? 'registeredAt'];
  const sortDir = options.sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const searchCondition = options.q
    ? Prisma.sql`AND (c.name ILIKE ${'%' + options.q + '%'} OR c.email ILIKE ${'%' + options.q + '%'} OR c.phone ILIKE ${'%' + options.q + '%'})`
    : Prisma.empty;

  const statusCondition = (() => {
    switch (options.status) {
      case 'New':
        return Prisma.sql`AND order_count = 0`;
      case 'Active':
        return Prisma.sql`AND order_count = 1 AND last_order_at >= NOW() - (${CUSTOMER_ACTIVE_WINDOW_DAYS} * INTERVAL '1 day')`;
      case 'Returning':
        return Prisma.sql`AND order_count >= 2 AND last_order_at >= NOW() - (${CUSTOMER_ACTIVE_WINDOW_DAYS} * INTERVAL '1 day')`;
      case 'Inactive':
        return Prisma.sql`AND order_count >= 1 AND last_order_at < NOW() - (${CUSTOMER_ACTIVE_WINDOW_DAYS} * INTERVAL '1 day')`;
      default:
        return Prisma.empty;
    }
  })();

  const rows = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      registered_at: Date;
      order_count: number;
      total_spend: bigint;
      last_order_at: Date | null;
      total_count: number;
    }[]
  >(Prisma.sql`
    WITH customer_stats AS (
      SELECT
        c.id, c.name, c.email, c.phone, c."createdAt" AS registered_at,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(CASE WHEN o."paymentStatus" = 'PAID' THEN o.total ELSE 0 END), 0)::bigint AS total_spend,
        MAX(o."createdAt") AS last_order_at
      FROM "Customer" c
      LEFT JOIN "Order" o ON o."customerId" = c.id
      WHERE 1 = 1 ${searchCondition}
      GROUP BY c.id
    )
    SELECT *, COUNT(*) OVER()::int AS total_count
    FROM customer_stats
    WHERE 1 = 1 ${statusCondition}
    ORDER BY ${Prisma.raw(sortColumn)} ${sortDir} NULLS LAST, id ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      registeredAt: r.registered_at,
      orderCount: r.order_count,
      totalSpend: Number(r.total_spend),
      lastOrderAt: r.last_order_at,
      status: deriveCustomerStatus(r.order_count, r.last_order_at),
    })),
    total: rows[0]?.total_count ?? 0,
    page,
    pageSize,
  };
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registeredAt: Date;
  status: CustomerStatus;
  stats: {
    totalOrders: number;
    totalSpend: number;
    averageOrderValue: number;
    firstOrderAt: Date | null;
    lastOrderAt: Date | null;
  };
  orders: {
    id: string;
    orderNumber: string;
    createdAt: Date;
    status: string;
    paymentStatus: string;
    total: number;
    itemCount: number;
  }[];
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { id: true } } },
      },
    },
  });
  if (!customer) return null;

  const paidOrders = customer.orders.filter((o) => o.paymentStatus === 'PAID');
  const totalSpend = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const lastOrderAt = customer.orders[0]?.createdAt ?? null;
  const firstOrderAt = customer.orders.length > 0 ? customer.orders[customer.orders.length - 1].createdAt : null;

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    registeredAt: customer.createdAt,
    status: deriveCustomerStatus(customer.orders.length, lastOrderAt),
    stats: {
      totalOrders: customer.orders.length,
      totalSpend,
      averageOrderValue: paidOrders.length > 0 ? Math.round(totalSpend / paidOrders.length) : 0,
      firstOrderAt,
      lastOrderAt,
    },
    orders: customer.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: o.total,
      itemCount: o.items.length,
    })),
  };
}
