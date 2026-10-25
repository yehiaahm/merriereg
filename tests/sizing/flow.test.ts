// Integration test for the Find My Size flow against the REAL database:
// chart resolution (product → category, verified only) → recommendation
// against live variants → the recommended variant goes through the same
// cart + checkout code the product page uses.
//
// Requires the local Postgres (npm run db:local). Creates its own temporary
// TEST products/charts and removes them afterwards. The charts are synthetic
// test data, never real MERRIER sizing.
// Run: npm run test:sizing
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../lib/prisma';
import { getSizeChartForProduct } from '../../lib/sizing/charts';
import { recommendSize } from '../../lib/sizing/engine';
import { getCartById, cartTotals } from '../../lib/cart';
import { createOrderFromCart } from '../../lib/orders';

const tag = `sizingtest-${Date.now()}`;
const ids = { categories: [] as string[], products: [] as string[], charts: [] as string[], carts: [] as string[], orders: [] as string[] };

const SIZES = [
  { size: 'S', measurements: { CHEST: { min: 88, max: 93 } } },
  { size: 'M', measurements: { CHEST: { min: 96, max: 101 } } },
  { size: 'L', measurements: { CHEST: { min: 104, max: 109 } } },
];

async function chart(name: string, verified: boolean, sizes: unknown = SIZES) {
  const c = await prisma.sizeChart.create({
    data: { name: `${tag} ${name}`, basis: 'BODY', verified, source: verified ? 'Test fixture' : null, sizes: sizes as never, ease: {} },
  });
  ids.charts.push(c.id);
  return c;
}

async function product(name: string, opts: { categoryId?: string; sizeChartId?: string; stocks: Record<string, number> }) {
  const p = await prisma.product.create({
    data: {
      name: `${tag} ${name}`,
      slug: `${tag}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      description: 'Test product',
      status: 'ACTIVE',
      categoryId: opts.categoryId,
      sizeChartId: opts.sizeChartId,
      variants: {
        create: Object.entries(opts.stocks).map(([size, stock]) => ({
          size,
          color: 'Black',
          sku: `${tag}-${name}-${size}`.replace(/\s+/g, ''),
          price: 50000,
          stock,
        })),
      },
    },
    include: { variants: true },
  });
  ids.products.push(p.id);
  return p;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  if (ids.orders.length) await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
  if (ids.carts.length) await prisma.cart.deleteMany({ where: { id: { in: ids.carts } } });
  await prisma.product.deleteMany({ where: { id: { in: ids.products } } });
  await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  await prisma.sizeChart.deleteMany({ where: { id: { in: ids.charts } } });
  await prisma.$disconnect();
});

describe('chart resolution', () => {
  test('a product with no chart and no category chart gets no recommendation', async () => {
    const p = await product('No Chart', { stocks: { S: 3, M: 3, L: 3 } });
    assert.equal(await getSizeChartForProduct(p.id), null);
  });

  test('category chart applies to its products', async () => {
    const c = await chart('category chart', true);
    const cat = await prisma.category.create({ data: { name: `${tag} cat`, slug: `${tag}-cat`, sizeChartId: c.id } });
    ids.categories.push(cat.id);
    const p = await product('In Category', { categoryId: cat.id, stocks: { S: 3, M: 3, L: 3 } });
    assert.equal((await getSizeChartForProduct(p.id))?.id, c.id);
  });

  test('product chart overrides the category chart', async () => {
    const catChart = await chart('cat', true);
    const ownChart = await chart('own', true, [{ size: 'M', measurements: { CHEST: { min: 90, max: 100 } } }]);
    const cat = await prisma.category.create({ data: { name: `${tag} cat2`, slug: `${tag}-cat2`, sizeChartId: catChart.id } });
    ids.categories.push(cat.id);
    const p = await product('Override', { categoryId: cat.id, sizeChartId: ownChart.id, stocks: { M: 3 } });
    assert.equal((await getSizeChartForProduct(p.id))?.id, ownChart.id);
  });

  test('unverified charts are never used — and do not fall back to the category chart', async () => {
    const catChart = await chart('verified cat', true);
    const draft = await chart('draft', false);
    const cat = await prisma.category.create({ data: { name: `${tag} cat3`, slug: `${tag}-cat3`, sizeChartId: catChart.id } });
    ids.categories.push(cat.id);
    const p = await product('Draft Own', { categoryId: cat.id, sizeChartId: draft.id, stocks: { S: 3 } });
    assert.equal(await getSizeChartForProduct(p.id), null);
  });

  test('a chart whose stored data is corrupt is ignored', async () => {
    const bad = await chart('corrupt', true, 'not-an-array');
    const p = await product('Corrupt', { sizeChartId: bad.id, stocks: { S: 3 } });
    assert.equal(await getSizeChartForProduct(p.id), null);
  });

  test('deleting a chart detaches products instead of breaking them', async () => {
    const c = await chart('to delete', true);
    const p = await product('Detach', { sizeChartId: c.id, stocks: { S: 3 } });
    await prisma.sizeChart.delete({ where: { id: c.id } });
    assert.equal((await prisma.product.findUnique({ where: { id: p.id } }))?.sizeChartId, null);
    assert.equal(await getSizeChartForProduct(p.id), null);
  });
});

describe('recommendation against live variants, then cart and checkout', () => {
  test('recommends only in-stock sizes and the result checks out', async () => {
    const c = await chart('flow', true);
    const p = await product('Flow', { sizeChartId: c.id, stocks: { S: 4, M: 0, L: 2 } });
    const loaded = await getSizeChartForProduct(p.id);
    assert.ok(loaded);

    // M is the ideal size but is out of stock → no silent substitution.
    const outOfStock = recommendSize(loaded, { measurements: { CHEST: 98.5 }, preferredFit: null }, p.variants, 'Black');
    assert.equal(outOfStock.status, 'unavailable');
    assert.equal(outOfStock.recommendedSize, null);

    // Between M and L with M out of stock → L, flagged as a substitute.
    const between = recommendSize(loaded, { measurements: { CHEST: 102.5 }, preferredFit: null }, p.variants, 'Black');
    assert.equal(between.status, 'recommended');
    assert.equal(between.recommendedSize, 'L');

    // "Apply this size": the recommended label resolves to a real variant…
    const variant = p.variants.find((v) => v.color === 'Black' && v.size === between.recommendedSize);
    assert.ok(variant && variant.active && variant.stock > 0);

    // …which goes through the same cart + checkout path as a manual selection.
    const cart = await prisma.cart.create({ data: {} });
    ids.carts.push(cart.id);
    await prisma.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: 1 } });
    const withItems = (await getCartById(cart.id))!;
    assert.equal(withItems.items[0].variant.size, 'L');
    assert.equal(cartTotals(withItems).subtotal, 50000);

    const order = await createOrderFromCart(withItems, {
      customerName: 'Sizing Test',
      customerPhone: '01012345678',
      customerEmail: '',
      shippingGovernorate: 'Cairo',
      shippingArea: 'Test',
      shippingStreet: 'Test',
      shippingBuilding: '1',
      paymentMethod: 'COD',
    } as never);
    ids.orders.push(order.id);
    assert.equal(order.items[0].variantSize, 'L');
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } }))!.stock, 1);
  });

  test('switching products: each product is judged by its own chart', async () => {
    const small = await chart('small chart', true, SIZES);
    const big = await chart('big chart', true, [
      { size: 'S', measurements: { CHEST: { min: 100, max: 105 } } },
      { size: 'M', measurements: { CHEST: { min: 108, max: 113 } } },
    ]);
    const a = await product('Switch A', { sizeChartId: small.id, stocks: { S: 1, M: 1, L: 1 } });
    const b = await product('Switch B', { sizeChartId: big.id, stocks: { S: 1, M: 1 } });
    const measurements = { CHEST: 90 };
    const forA = recommendSize((await getSizeChartForProduct(a.id))!, { measurements, preferredFit: null }, a.variants, 'Black');
    const forB = recommendSize((await getSizeChartForProduct(b.id))!, { measurements, preferredFit: null }, b.variants, 'Black');
    assert.equal(forA.recommendedSize, 'S');
    // 90 cm is 10 cm below B's smallest size: no recommendation rather than a wrong one.
    assert.notEqual(forB.status, 'recommended');
  });
});
