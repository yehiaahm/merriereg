// Assertion-style tests for the admin analytics service layer (lib/analytics/*),
// following the same pattern as scripts/test-e2e.ts. Runs against the real
// local database — creates its own isolated test rows and cleans them up.
import { prisma } from '../lib/prisma';
import { resolveDateRange, getPreviousPeriod } from '../lib/analytics/dates';
import { computeDelta } from '../lib/analytics/format';
import { getOverviewMetrics } from '../lib/analytics/overview';
import { getBestSellingProducts, netLineRevenue } from '../lib/analytics/products';
import { deriveCustomerStatus, listCustomers, getCustomerDetail, CUSTOMER_ACTIVE_WINDOW_DAYS } from '../lib/analytics/customers';
import { egpToPiastres } from '../lib/money';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== STARTING ANALYTICS SERVICE TESTS ===\n');

  // 1. Date range resolution
  console.log('1. Testing date range presets...');
  const today = resolveDateRange('today');
  assert(today.end.getTime() - today.start.getTime() === 86_400_000, 'today must span exactly 24h');
  const last7 = resolveDateRange('last7');
  assert(last7.end.getTime() - last7.start.getTime() === 8 * 86_400_000, 'last7 must span 8 days (7 back + today)');
  const custom = resolveDateRange('custom', '2026-01-01', '2026-01-31');
  assert(custom.end.getTime() - custom.start.getTime() === 31 * 86_400_000, 'custom Jan 1-31 must span 31 days');
  const prev = getPreviousPeriod({ start: new Date('2026-02-01T00:00:00Z'), end: new Date('2026-03-01T00:00:00Z') });
  assert(prev.end.getTime() === new Date('2026-02-01T00:00:00Z').getTime(), 'previous period must end where the current one starts');
  console.log('   ✓ Date range math verified.\n');

  // 2. Delta / comparison math
  console.log('2. Testing period-over-period delta math...');
  const up = computeDelta(150, 100);
  assert(up.percent === 50, 'increase from 100 to 150 must be +50%');
  assert(up.direction === 'up', 'direction must be up');
  const fromZero = computeDelta(100, 0);
  assert(fromZero.percent === null, 'percent must be null when previous period was zero');
  assert(fromZero.previousWasZero === true, 'previousWasZero must be true');
  const flat = computeDelta(0, 0);
  assert(flat.direction === 'flat', 'zero to zero must be flat');
  console.log('   ✓ Delta math verified.\n');

  // 3. Customer status derivation
  console.log('3. Testing customer status derivation...');
  assert(deriveCustomerStatus(0, null) === 'New', 'no orders ever must be New');
  assert(deriveCustomerStatus(1, new Date()) === 'Active', 'one recent order must be Active');
  assert(deriveCustomerStatus(3, new Date()) === 'Returning', 'multiple recent orders must be Returning');
  const longAgo = new Date(Date.now() - (CUSTOMER_ACTIVE_WINDOW_DAYS + 5) * 86_400_000);
  assert(deriveCustomerStatus(2, longAgo) === 'Inactive', 'orders outside the active window must be Inactive');
  assert(deriveCustomerStatus(1, longAgo) === 'Inactive', 'a single stale order must also be Inactive, not Active');
  console.log('   ✓ Customer status derivation verified.\n');

  // 4. Revenue must only count PAID orders — isolated scenario with its own
  //    customer/orders so it can't be skewed by whatever's already in the DB.
  console.log('4. Testing revenue counts only PAID orders (isolated scenario)...');
  const testEmail = `analytics-test-${Date.now()}@merrier.test`;
  const customer = await prisma.customer.create({
    data: { name: 'Analytics Test Customer', email: testEmail, passwordHash: 'x', isAdmin: false },
  });

  const rangeStart = new Date(Date.now() - 60_000);
  const baseOrder = {
    customerId: customer.id,
    customerName: 'Analytics Test Customer',
    customerPhone: '01000000000',
    customerEmail: testEmail,
    shippingGovernorate: 'Cairo',
    shippingCity: 'Cairo',
    shippingArea: 'Test',
    shippingStreet: 'Test',
    shippingBuilding: '1',
    paymentMethod: 'COD' as const,
  };

  const paidOrder = await prisma.order.create({
    data: {
      ...baseOrder,
      orderNumber: `ANALYTICS-TEST-PAID-${Date.now()}`,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      subtotal: egpToPiastres(1000),
      shippingCost: egpToPiastres(70),
      total: egpToPiastres(1070),
    },
  });
  const pendingOrder = await prisma.order.create({
    data: {
      ...baseOrder,
      orderNumber: `ANALYTICS-TEST-PENDING-${Date.now()}`,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      subtotal: egpToPiastres(500),
      shippingCost: egpToPiastres(70),
      total: egpToPiastres(570),
    },
  });
  const cancelledOrder = await prisma.order.create({
    data: {
      ...baseOrder,
      orderNumber: `ANALYTICS-TEST-CANCELLED-${Date.now()}`,
      status: 'CANCELLED',
      paymentStatus: 'CANCELLED',
      subtotal: egpToPiastres(2000),
      shippingCost: egpToPiastres(70),
      total: egpToPiastres(2070),
    },
  });

  const range = { start: rangeStart, end: new Date(Date.now() + 60_000) };
  const metrics = await getOverviewMetrics(range);
  assert(metrics.revenue.current === egpToPiastres(1070), `revenue must equal only the PAID order's total, got ${metrics.revenue.current}`);
  assert(metrics.orders.current === 3, 'order volume must count all 3 orders regardless of payment status');
  console.log('   ✓ Revenue correctly excludes PENDING/CANCELLED orders.\n');

  // 5. Customer detail stats derived from the same isolated scenario
  console.log('5. Testing customer detail stats...');
  const detail = await getCustomerDetail(customer.id);
  assert(detail !== null, 'customer detail must be found');
  assert(detail!.stats.totalOrders === 3, 'totalOrders must count all orders');
  assert(detail!.stats.totalSpend === egpToPiastres(1070), 'totalSpend must only include the PAID order');
  assert(detail!.stats.averageOrderValue === egpToPiastres(1070), 'AOV with 1 paid order must equal that order total');
  assert(detail!.status === 'Returning', 'a customer with 3 recent orders (1 paid, 1 pending, 1 cancelled) must be Returning');
  console.log('   ✓ Customer detail stats verified.\n');

  // 6. listCustomers search + pagination shape
  console.log('6. Testing listCustomers search...');
  const found = await listCustomers({ q: testEmail, page: 1, pageSize: 10 });
  assert(found.rows.length === 1, 'search by exact email must return exactly the test customer');
  assert(found.rows[0].id === customer.id, 'returned row must be the test customer');
  assert(found.total === 1, 'total count must be 1');
  console.log('   ✓ listCustomers search verified.\n');

  // 7. Best-selling products excludes non-PAID orders
  console.log('7. Testing best-selling products excludes non-PAID orders...');
  await prisma.orderItem.create({
    data: {
      orderId: paidOrder.id,
      productName: 'Analytics Test Product',
      variantSize: 'M',
      variantColor: 'Black',
      sku: `ANALYTICS-TEST-SKU-${Date.now()}`,
      unitPrice: egpToPiastres(1000),
      quantity: 1,
      subtotal: egpToPiastres(1000),
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: pendingOrder.id,
      productName: 'Analytics Test Product (should not count)',
      variantSize: 'M',
      variantColor: 'Black',
      sku: `ANALYTICS-TEST-SKU-PENDING-${Date.now()}`,
      unitPrice: egpToPiastres(500),
      quantity: 1,
      subtotal: egpToPiastres(500),
    },
  });
  const bestSellers = await getBestSellingProducts(range, 20);
  const namesInResult = bestSellers.map((p) => p.name);
  assert(namesInResult.includes('Analytics Test Product'), 'the paid order item must appear in best-sellers');
  assert(!namesInResult.includes('Analytics Test Product (should not count)'), 'the pending order item must NOT appear in best-sellers');
  console.log('   ✓ Best-sellers correctly excludes non-PAID order items.\n');

  // 7b. Order-level discounts must be prorated onto line-item revenue, so
  //     product/category totals reconcile with the order-level revenue KPI
  //     instead of reporting pre-discount gross (found via a real
  //     discrepancy against this store's actual POS sale data).
  console.log('7b. Testing discount proration onto line-item revenue...');
  assert(netLineRevenue(1000, { subtotal: 1000, discount: 100 }) === 900, '10% order discount must reduce a full-order line by 10%');
  assert(netLineRevenue(500, { subtotal: 1000, discount: 100 }) === 450, 'a half-order line must absorb half the discount');
  assert(netLineRevenue(500, { subtotal: 0, discount: 0 }) === 500, 'a zero-subtotal order must not divide by zero');
  console.log('   ✓ Discount proration verified.\n');

  // 8. Clean up
  console.log('8. Cleaning up test data...');
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [paidOrder.id, pendingOrder.id, cancelledOrder.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [paidOrder.id, pendingOrder.id, cancelledOrder.id] } } });
  await prisma.customer.delete({ where: { id: customer.id } });
  console.log('   ✓ Test data cleaned up.\n');

  console.log('=== ALL ANALYTICS TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((e) => {
    console.error('\n❌ Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
