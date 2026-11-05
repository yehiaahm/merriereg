// Unit tests for discount-code pricing and the admin request schema. No
// database needed.
// Run: npm run test:discounts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartDiscount,
  describeDiscountRule,
  discountAmountForRule,
  normalizeCouponCode,
  type DiscountRule,
} from '../../lib/promotions';
import { discountCodeRequestSchema } from '../../lib/discount-codes-schema';

const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  code: 'TEST',
  type: 'PERCENT',
  value: 10,
  maxDiscount: null,
  minSubtotal: 0,
  ...over,
});

const lines = [{ price: 50_000, quantity: 2, categorySlug: 'pants' }]; // 1,000 EGP

describe('discountAmountForRule', () => {
  test('percentage rounds to the nearest piastre', () => {
    assert.equal(discountAmountForRule(rule({ value: 10 }), 100_000), 10_000);
    assert.equal(discountAmountForRule(rule({ value: 15 }), 3_333), 500);
  });

  test('percentage honours the maximum discount cap', () => {
    assert.equal(discountAmountForRule(rule({ value: 50, maxDiscount: 20_000 }), 100_000), 20_000);
  });

  test('fixed amount is capped at the order total (never negative totals)', () => {
    assert.equal(discountAmountForRule(rule({ type: 'FIXED', value: 5_000 }), 100_000), 5_000);
    assert.equal(discountAmountForRule(rule({ type: 'FIXED', value: 500_000 }), 100_000), 100_000);
  });

  test('empty basket gets no discount', () => {
    assert.equal(discountAmountForRule(rule(), 0), 0);
  });
});

describe('calculateCartDiscount', () => {
  test('no code means no coupon discount', () => {
    const d = calculateCartDiscount(lines, null);
    assert.equal(d.couponApplied, false);
    assert.equal(d.total, 100_000);
  });

  test('applies a percentage code to the subtotal', () => {
    const d = calculateCartDiscount(lines, rule({ value: 10 }));
    assert.equal(d.couponApplied, true);
    assert.equal(d.couponAmount, 10_000);
    assert.equal(d.total, 90_000);
  });

  test('below the minimum order the code is not applied and the shortfall is reported', () => {
    const d = calculateCartDiscount(lines, rule({ minSubtotal: 150_000 }));
    assert.equal(d.couponApplied, false);
    assert.equal(d.couponAmount, 0);
    assert.equal(d.couponMinSubtotalMissing, 50_000);
    assert.equal(d.total, 100_000);
  });

  test('exactly at the minimum order is accepted', () => {
    const d = calculateCartDiscount(lines, rule({ minSubtotal: 100_000 }));
    assert.equal(d.couponApplied, true);
  });
});

describe('describeDiscountRule / normalizeCouponCode', () => {
  test('describes percentage and fixed codes', () => {
    assert.equal(describeDiscountRule({ type: 'PERCENT', value: 10 }), '10% off');
    assert.equal(describeDiscountRule({ type: 'FIXED', value: 5_000 }), 'EGP 50 off');
    assert.equal(describeDiscountRule({ type: 'FIXED', value: 4_950 }), 'EGP 49.50 off');
  });

  test('lookups ignore case and surrounding spaces', () => {
    assert.equal(normalizeCouponCode('  Pasmala.1 '), 'PASMALA.1');
    assert.equal(normalizeCouponCode(null), '');
  });
});

describe('discountCodeRequestSchema', () => {
  const valid = { code: 'Pasmala.1', type: 'PERCENT', value: 10 };

  test('accepts a minimal percentage code and fills defaults', () => {
    const r = discountCodeRequestSchema.parse(valid);
    assert.equal(r.minSubtotal, 0);
    assert.equal(r.usageLimit, null);
    assert.equal(r.active, true);
    assert.equal(r.showAtCheckout, true);
  });

  test('rejects over 100% and malformed codes', () => {
    assert.equal(discountCodeRequestSchema.safeParse({ ...valid, value: 101 }).success, false);
    assert.equal(discountCodeRequestSchema.safeParse({ ...valid, code: 'a b' }).success, false);
    assert.equal(discountCodeRequestSchema.safeParse({ ...valid, code: 'ab' }).success, false);
  });

  test('rejects a maximum discount on fixed codes and a backwards date range', () => {
    assert.equal(
      discountCodeRequestSchema.safeParse({ ...valid, type: 'FIXED', value: 5_000, maxDiscount: 1_000 }).success,
      false
    );
    assert.equal(
      discountCodeRequestSchema.safeParse({
        ...valid,
        startsAt: '2026-12-01T00:00:00.000Z',
        expiresAt: '2026-11-01T00:00:00.000Z',
      }).success,
      false
    );
  });
});
