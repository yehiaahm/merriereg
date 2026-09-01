// Store-wide cart promotions. Pure functions with no server-only imports so
// they can run both server-side (checkout) and client-side (live estimates
// in the cart/checkout UI) from the same source of truth.

export const FOLLOW_DISCOUNT_CODE = 'FOLLOW10';
export const FOLLOW_DISCOUNT_RATE = 0.1;

export type PromoLine = { price: number; quantity: number };

export type TierDiscount = {
  freeCount: number;
  amount: number;
  label: string | null;
};

/**
 * Buy 1 Get 1 Free, applied across the whole cart: for every 2 units in the
 * cart, the cheaper of the pair is free (e.g. 2 items -> 1 free, 4 items ->
 * 2 free).
 */
export function tierDiscount(items: PromoLine[]): TierDiscount {
  const { freeCount, amount, label } = tierDiscountDetailed(
    items.map((item, i) => ({ id: String(i), name: '', price: item.price, quantity: item.quantity }))
  );
  return { freeCount, amount, label };
}

export type PromoLineDetailed = { id: string; name: string; price: number; quantity: number };
export type FreeGroup = { id: string; name: string; count: number };
export type TierDiscountDetailed = TierDiscount & { freeGroups: FreeGroup[] };

/** Same math as {@link tierDiscount}, but also reports which line(s) the free unit(s) come from, for "you got a free X" messaging. */
export function tierDiscountDetailed(items: PromoLineDetailed[]): TierDiscountDetailed {
  const units: { id: string; name: string; price: number }[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) units.push({ id: item.id, name: item.name, price: item.price });
  }
  units.sort((a, b) => a.price - b.price);
  const totalQty = units.length;

  const freeCount = Math.floor(totalQty / 2);
  const label = freeCount > 0 ? 'Buy 1 Get 1 Free' : null;

  const freeUnits = units.slice(0, freeCount);
  const amount = freeUnits.reduce((sum, u) => sum + u.price, 0);

  const groups = new Map<string, FreeGroup>();
  for (const u of freeUnits) {
    const g = groups.get(u.id) ?? { id: u.id, name: u.name, count: 0 };
    g.count++;
    groups.set(u.id, g);
  }

  return { freeCount, amount, label, freeGroups: Array.from(groups.values()) };
}

/** "🎉 Buy 1 Get 1 Free — 2 × Black Tee are FREE!" — null when no tier is unlocked. */
export function formatFreeItemsMessage(tier: TierDiscountDetailed): string | null {
  if (tier.freeCount === 0 || !tier.label) return null;
  const parts = tier.freeGroups.map((g) => (g.count > 1 ? `${g.count} × ${g.name}` : g.name));
  const verb = tier.freeCount > 1 ? 'are FREE' : 'is FREE';
  return `${tier.label} — ${parts.join(' + ')} ${verb}!`;
}

export function normalizeCouponCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

export function isFollowCouponValid(code: string | null | undefined): boolean {
  return normalizeCouponCode(code) === FOLLOW_DISCOUNT_CODE;
}

export type CartDiscount = {
  subtotal: number;
  tierAmount: number;
  tierLabel: string | null;
  couponApplied: boolean;
  couponAmount: number;
  totalDiscount: number;
  total: number;
};

/** Applies the quantity-tier discount first, then 10% off the remainder for a valid FOLLOW10 code. */
export function calculateCartDiscount(items: PromoLine[], couponCode?: string | null): CartDiscount {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tier = tierDiscount(items);
  const afterTier = subtotal - tier.amount;

  const couponApplied = isFollowCouponValid(couponCode);
  const couponAmount = couponApplied ? Math.round(afterTier * FOLLOW_DISCOUNT_RATE) : 0;

  const totalDiscount = tier.amount + couponAmount;
  return {
    subtotal,
    tierAmount: tier.amount,
    tierLabel: tier.label,
    couponApplied,
    couponAmount,
    totalDiscount,
    total: subtotal - totalDiscount,
  };
}
