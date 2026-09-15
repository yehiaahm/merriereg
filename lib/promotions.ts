// Store-wide cart promotions. Pure functions with no server-only imports so
// they can run both server-side (checkout) and client-side (live estimates
// in the cart/checkout UI) from the same source of truth.

export const FOLLOW_DISCOUNT_CODE = 'FOLLOW10';
export const FOLLOW_DISCOUNT_RATE = 0.1;

export type BundleRule = {
  categorySlug: string;
  bundleSize: number;
  /** Piastres. */
  bundlePrice: number;
  label: string;
};

// 3-for-a-fixed-price bundles, mix-and-match within a category (any color,
// any size). Keyed by Category.slug — see scripts/setup-bundle-categories.mjs
// for how the catalog is assigned into these three categories.
export const BUNDLE_RULES: BundleRule[] = [
  { categorySlug: 'pants', bundleSize: 3, bundlePrice: 150_000, label: '3 Pants for 1,500 LE' },
  { categorySlug: 't-shirts', bundleSize: 3, bundlePrice: 95_000, label: '3 T-Shirts for 950 LE' },
  { categorySlug: 'shorts', bundleSize: 3, bundlePrice: 70_000, label: '3 Shorts for 700 LE' },
];

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

export function isFollowCouponValid(code: string | null | undefined): boolean {
  return normalizeCouponCode(code) === FOLLOW_DISCOUNT_CODE;
}

export type CartDiscount = {
  subtotal: number;
  bundleAmount: number;
  bundleGroups: BundleGroup[];
  couponApplied: boolean;
  couponAmount: number;
  totalDiscount: number;
  total: number;
};

/** Applies category bundle pricing first, then 10% off the remainder for a valid FOLLOW10 code. */
export function calculateCartDiscount(items: PromoLine[], couponCode?: string | null): CartDiscount {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const bundle = bundleDiscount(items);
  const afterBundle = subtotal - bundle.amount;

  const couponApplied = isFollowCouponValid(couponCode);
  const couponAmount = couponApplied ? Math.round(afterBundle * FOLLOW_DISCOUNT_RATE) : 0;

  const totalDiscount = bundle.amount + couponAmount;
  return {
    subtotal,
    bundleAmount: bundle.amount,
    bundleGroups: bundle.groups,
    couponApplied,
    couponAmount,
    totalDiscount,
    total: subtotal - totalDiscount,
  };
}
