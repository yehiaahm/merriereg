import type { DiscountCode, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import {
  describeDiscountRule,
  normalizeCouponCode,
  type DiscountRule,
} from '@/lib/promotions';

// Server-side half of the discount-code system. The pure pricing math lives in
// lib/promotions.ts (shared with the browser); everything that touches the
// database or decides whether a code may be redeemed lives here.

type Db = Prisma.TransactionClient | typeof prisma;

export type DiscountCodeStatus = 'active' | 'scheduled' | 'expired' | 'used_up' | 'disabled';

export function toDiscountRule(row: DiscountCode): DiscountRule {
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    maxDiscount: row.maxDiscount,
    minSubtotal: row.minSubtotal,
  };
}

export function discountCodeStatus(row: DiscountCode, now: Date = new Date()): DiscountCodeStatus {
  if (!row.active) return 'disabled';
  if (row.expiresAt && row.expiresAt <= now) return 'expired';
  if (row.startsAt && row.startsAt > now) return 'scheduled';
  if (row.usageLimit !== null && row.usedCount >= row.usageLimit) return 'used_up';
  return 'active';
}

const GENERIC_INVALID = 'That promo code is not valid.';

export type CodeCheck =
  | { ok: true; row: DiscountCode; rule: DiscountRule }
  | { ok: false; message: string };

/**
 * Looks a code up and checks everything that does not depend on the customer:
 * exists, enabled, inside its date window, not used up. (The minimum
 * subtotal is checked by the caller against the cart, and the per-customer
 * limit inside the order transaction.) Unknown and disabled codes share one
 * generic message so the response never reveals which codes exist.
 */
export async function checkDiscountCode(
  db: Db,
  code: string | null | undefined,
  now: Date = new Date()
): Promise<CodeCheck> {
  const key = normalizeCouponCode(code);
  if (!key) return { ok: false, message: GENERIC_INVALID };

  const row = await db.discountCode.findUnique({ where: { codeKey: key } });
  if (!row) return { ok: false, message: GENERIC_INVALID };

  switch (discountCodeStatus(row, now)) {
    case 'disabled':
      return { ok: false, message: GENERIC_INVALID };
    case 'expired':
      return { ok: false, message: 'This promo code has expired.' };
    case 'scheduled':
      return { ok: false, message: 'This promo code is not active yet.' };
    case 'used_up':
      return { ok: false, message: 'This promo code has reached its usage limit.' };
    default:
      return { ok: true, row, rule: toDiscountRule(row) };
  }
}

export function minSubtotalMessage(rule: Pick<DiscountRule, 'minSubtotal'>): string {
  return `Spend at least ${formatEGP(rule.minSubtotal)} to use this code.`;
}

/**
 * Redeems a code inside the order transaction: enforces the per-customer
 * limit, then atomically takes one use. The conditional UPDATE is what makes
 * the usage limit safe under concurrent checkouts — two orders racing for the
 * last use cannot both succeed.
 */
export async function redeemDiscountCode(
  tx: Prisma.TransactionClient,
  row: DiscountCode,
  customer: { customerId?: string | null; phone: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (row.oncePerCustomer) {
    const who: Prisma.OrderWhereInput[] = [{ customerPhone: customer.phone }];
    if (customer.customerId) who.push({ customerId: customer.customerId });
    const previous = await tx.order.count({
      where: {
        couponCode: { equals: row.code, mode: 'insensitive' },
        status: { notIn: ['CANCELLED'] },
        OR: who,
      },
    });
    if (previous > 0) return { ok: false, message: 'You have already used this promo code.' };
  }

  const taken = await tx.$executeRaw`
    UPDATE "DiscountCode"
    SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
    WHERE "id" = ${row.id}
      AND "active" = true
      AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
  if (taken === 0) return { ok: false, message: 'This promo code has reached its usage limit.' };
  return { ok: true };
}

/** Gives a use back when an order that redeemed `couponCode` is cancelled. */
export async function releaseDiscountCode(tx: Prisma.TransactionClient, couponCode: string | null | undefined) {
  const key = normalizeCouponCode(couponCode);
  if (!key) return;
  await tx.$executeRaw`
    UPDATE "DiscountCode"
    SET "usedCount" = "usedCount" - 1, "updatedAt" = NOW()
    WHERE "codeKey" = ${key} AND "usedCount" > 0`;
}

export type PublicOffer = { rule: DiscountRule; label: string };

/** Currently-redeemable codes the admin chose to advertise at checkout. */
export async function listCheckoutOffers(now: Date = new Date()): Promise<PublicOffer[]> {
  try {
    const rows = await prisma.discountCode.findMany({
      where: { active: true, showAtCheckout: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((r) => discountCodeStatus(r, now) === 'active')
      .map((r) => ({ rule: toDiscountRule(r), label: r.label?.trim() || describeDiscountRule(r) }));
  } catch (err) {
    // Never let a promo lookup break checkout.
    console.error('Could not load checkout offers', err);
    return [];
  }
}

/** Messages for the scrolling promo bar: every redeemable code flagged "show in bar". */
export async function listPromoBarMessages(now: Date = new Date()): Promise<string[]> {
  try {
    const rows = await prisma.discountCode.findMany({
      where: { active: true, showInBar: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((r) => discountCodeStatus(r, now) === 'active')
      .map((r) => r.barText?.trim() || `${r.label?.trim() || describeDiscountRule(r)} (Code: ${r.code})`);
  } catch (err) {
    console.error('Could not load promo bar codes', err);
    return [];
  }
}
