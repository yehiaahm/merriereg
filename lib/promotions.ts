// Store-wide cart promotions. Pure functions with no server-only imports so
// they can run both server-side (checkout) and client-side (live estimates
// in the cart/checkout UI) from the same source of truth.

export type BundleRule = {
  categorySlug: string;
  bundleSize: number;
  /** Piastres. */
  bundlePrice: number;
  label: string;
};

// 3-for-a-fixed-price bundles, mix-and-match within a category (any color,
// any size), keyed by Category.slug. Currently NONE: the only active offers are
// admin-managed discount codes (lib/discount-codes.ts). The earlier rules were:
//   { categorySlug: 'pants',    bundleSize: 3, bundlePrice: 150_000, label: '3 Pants for 1,500 LE' }
//   { categorySlug: 't-shirts', bundleSize: 3, bundlePrice:  95_000, label: '3 T-Shirts for 950 LE' }
//   { categorySlug: 'shorts',   bundleSize: 3, bundlePrice:  70_000, label: '3 Shorts for 700 LE' }
// Add rules back here (and in components/PromoBar.tsx) to re-enable them; the
// cart, checkout and order code already handle any number of rules.
export const BUNDLE_RULES: BundleRule[] = [];

export type PromoLine = { price: number; quantity: number; categorySlug: string | null };

export type BundleGroup = { categorySlug: string; label: string; bundleCount: number; amount: number };
export type BundleDiscount = { amount: number; groups: BundleGroup[] };

/**
 * Mix-and-match bundle pricing: every complete set of `bundleSize` units
 * within a category (any color/size combination) is charged at that rule's
 * flat `bundlePrice` instead of the sum of their individual prices. Leftover
 * units (fewer than bundleSize) are charged normally. The cheapest units are
 * the ones folded into a bundle, so the reported savings is never overstated.
 */
export function bundleDiscount(items: PromoLine[]): BundleDiscount {
  const groups: BundleGroup[] = [];
  let amount = 0;

  for (const rule of BUNDLE_RULES) {
    const unitPrices: number[] = [];
    for (const item of items) {
      if (item.categorySlug !== rule.categorySlug) continue;
      for (let i = 0; i < item.quantity; i++) unitPrices.push(item.price);
    }

    const bundleCount = Math.floor(unitPrices.length / rule.bundleSize);
    if (bundleCount === 0) continue;

    unitPrices.sort((a, b) => a - b);
    const bundledUnits = unitPrices.slice(0, bundleCount * rule.bundleSize);
    const bundledActualSum = bundledUnits.reduce((sum, p) => sum + p, 0);
    const savings = Math.max(0, bundledActualSum - bundleCount * rule.bundlePrice);
    if (savings === 0) continue;

    groups.push({ categorySlug: rule.categorySlug, label: rule.label, bundleCount, amount: savings });
    amount += savings;
  }

  return { amount, groups };
}

export function normalizeCouponCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

/**
 * The part of a DiscountCode row the pricing math (and the browser) needs.
 * Amounts are piastres; `value` is a whole percent for PERCENT codes.
 */
export type DiscountRule = {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
};

/** Discount a rule gives on `base` piastres (never more than `base`). */
export function discountAmountForRule(rule: DiscountRule, base: number): number {
  if (base <= 0) return 0;
  let amount = rule.type === 'PERCENT' ? Math.round((base * rule.value) / 100) : rule.value;
  if (rule.type === 'PERCENT' && rule.maxDiscount !== null) amount = Math.min(amount, rule.maxDiscount);
  return Math.max(0, Math.min(amount, base));
}

/** Short human label, e.g. "10% off" or "EGP 50 off". */
export function describeDiscountRule(rule: Pick<DiscountRule, 'type' | 'value'>): string {
  if (rule.type === 'PERCENT') return `${rule.value}% off`;
  const egp = rule.value / 100;
  return `EGP ${Number.isInteger(egp) ? egp : egp.toFixed(2)} off`;
}

export type CartDiscount = {
  subtotal: number;
  bundleAmount: number;
  bundleGroups: BundleGroup[];
  couponApplied: boolean;
  /** Set when a rule was passed but the cart is below its minimum subtotal. */
  couponMinSubtotalMissing: number;
  couponAmount: number;
  totalDiscount: number;
  total: number;
};

/** Applies category bundle pricing first, then the discount code (if any) to the remainder. */
export function calculateCartDiscount(items: PromoLine[], rule?: DiscountRule | null): CartDiscount {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const bundle = bundleDiscount(items);
  const afterBundle = subtotal - bundle.amount;

  const belowMinimum = !!rule && afterBundle < rule.minSubtotal;
  const couponApplied = !!rule && !belowMinimum;
  const couponAmount = rule && couponApplied ? discountAmountForRule(rule, afterBundle) : 0;

  const totalDiscount = bundle.amount + couponAmount;
  return {
    subtotal,
    bundleAmount: bundle.amount,
    bundleGroups: bundle.groups,
    couponApplied,
    couponMinSubtotalMissing: belowMinimum && rule ? rule.minSubtotal - afterBundle : 0,
    couponAmount,
    totalDiscount,
    total: subtotal - totalDiscount,
  };
}
