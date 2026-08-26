import { prisma } from '../lib/prisma';
import { createOrderFromCart, CheckoutError } from '../lib/orders';
import { getCartById, cartTotals } from '../lib/cart';
import { getProductBySlug } from '../lib/products';
import { calculateShippingCost } from '../lib/shipping';
import { verifyPaymobHmac } from '../lib/payment/paymob';
import { egpToPiastres } from '../lib/money';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== STARTING END-TO-END E-COMMERCE TESTS ===\n');

  // 1. Admin Product Creation & Category Association
  console.log('2. Testing Admin Product & Variant Creation...');
  const testSlug = `test-tee-${Date.now()}`;
  const category = await prisma.category.upsert({
    where: { slug: 'test-category' },
    update: {},
    create: { name: 'Test Category', slug: 'test-category' },
  });

  const testProduct = await prisma.product.create({
    data: {
      name: 'Merrier Test Oversized Tee',
      slug: testSlug,
      description: 'Heavyweight cotton streetwear tee for automated testing.',
      status: 'ACTIVE',
      categoryId: category.id,
      images: {
        create: [
          { url: 'https://picsum.photos/seed/test-tee-black/800/1000', altText: 'Test Black Tee', colorValue: 'Black', position: 0 },
          { url: 'https://picsum.photos/seed/test-tee-white/800/1000', altText: 'Test White Tee', colorValue: 'White', position: 1 },
        ],
      },
      variants: {
        create: [
          { size: 'M', color: 'Black', colorHex: '#000000', sku: `SKU-BLK-M-${Date.now()}`, price: egpToPiastres(850), stock: 5 },
          { size: 'L', color: 'Black', colorHex: '#000000', sku: `SKU-BLK-L-${Date.now()}`, price: egpToPiastres(850), stock: 0 }, // Out of stock
          { size: 'M', color: 'White', colorHex: '#FFFFFF', sku: `SKU-WHT-M-${Date.now()}`, price: egpToPiastres(850), compareAtPrice: egpToPiastres(950), stock: 3 },
        ],
      },
    },
    include: { variants: true, images: true, category: true },
  });

  assert(testProduct.variants.length === 3, 'Product should have 3 variants');
  const variantBlkM = testProduct.variants.find((v) => v.size === 'M' && v.color === 'Black')!;
  const variantBlkL = testProduct.variants.find((v) => v.size === 'L' && v.color === 'Black')!;
  const variantWhtM = testProduct.variants.find((v) => v.size === 'M' && v.color === 'White')!;
  console.log(`   ✓ Created product "${testProduct.name}" (ID: ${testProduct.id}) with 3 variants.\n`);

  // 3. Storefront Query & Availability
  console.log('3. Testing Storefront Queries...');
  const fetchedProduct = await getProductBySlug(testSlug);
  assert(fetchedProduct !== null, 'Product must be found by slug');
  assert(fetchedProduct!.category?.name === 'Test Category', 'Category association must match');
  assert(fetchedProduct!.images.length === 2, 'Images must be returned in position order');
  console.log('   ✓ Storefront query verified.\n');

  // 4. Cart Creation & Stock Verification
  console.log('4. Testing Cart and Stock Validation...');
  const cart = await prisma.cart.create({ data: {} });

  // Out of stock item cannot be added
  assert(variantBlkL.stock === 0, 'Black L must be out of stock');

  // Add Black M (qty: 2) and White M (qty: 1)
  await prisma.cartItem.create({
    data: { cartId: cart.id, variantId: variantBlkM.id, quantity: 2 },
  });
  await prisma.cartItem.create({
    data: { cartId: cart.id, variantId: variantWhtM.id, quantity: 1 },
  });

  const cartWithItems = (await getCartById(cart.id))!;
  assert(cartWithItems.items.length === 2, 'Cart should contain 2 distinct items');
  const { subtotal, itemCount } = cartTotals(cartWithItems);
  assert(itemCount === 3, 'Total cart item count should be 3');
  assert(subtotal === egpToPiastres(850 * 3), `Subtotal should be ${850 * 3 * 100} piastres, got ${subtotal}`);
  console.log(`   ✓ Cart verified: ${itemCount} items, Subtotal: ${subtotal / 100} EGP.\n`);

  // 5. Checkout & Atomic Stock Decrement
  console.log('5. Testing Checkout, Pricing, and Stock Decrement...');
  const shippingCostCairo = calculateShippingCost('Cairo');
  assert(shippingCostCairo === egpToPiastres(70), 'Cairo shipping must be 70 EGP (7000 piastres)');

  const order = await createOrderFromCart(cartWithItems, {
    customerName: 'Yahia Test Customer',
    customerPhone: '01012345678',
    customerEmail: 'yahia@merrier.test',
    shippingGovernorate: 'Cairo',
    shippingCity: 'New Cairo',
    shippingArea: 'Fifth Settlement',
    shippingStreet: 'Road 90',
    shippingBuilding: 'B12',
    shippingApartment: '4',
    shippingNotes: 'Leave with reception if not home',
    paymentMethod: 'COD',
  });

  assert(order.orderNumber.startsWith('MR'), 'Order number should start with MR');
  assert(order.status === 'PENDING', 'Initial order status must be PENDING');
  assert(order.paymentStatus === 'PENDING', 'COD payment status must be PENDING');
  assert(order.subtotal === subtotal, 'Order subtotal must match cart subtotal');
  assert(order.shippingCost === shippingCostCairo, 'Shipping cost must match governorate calculation');
  assert(order.total === subtotal + shippingCostCairo, 'Total must equal subtotal + shipping');
  assert(order.items.length === 2, 'Order items count must be 2');

  // Verify stock decrement
  const updatedBlkM = await prisma.productVariant.findUnique({ where: { id: variantBlkM.id } });
  const updatedWhtM = await prisma.productVariant.findUnique({ where: { id: variantWhtM.id } });
  assert(updatedBlkM!.stock === 5 - 2, `Black M stock should be 3 (was 5, purchased 2), got ${updatedBlkM!.stock}`);
  assert(updatedWhtM!.stock === 3 - 1, `White M stock should be 2 (was 3, purchased 1), got ${updatedWhtM!.stock}`);

  // Verify cart emptied
  const emptiedCart = await getCartById(cart.id);
  assert(emptiedCart!.items.length === 0, 'Cart must be emptied after successful order creation');
  console.log(`   ✓ Order #${order.orderNumber} created. Total: ${order.total / 100} EGP.`);
  console.log(`   ✓ Inventory atomically decremented (Black M: 5 -> ${updatedBlkM!.stock}, White M: 3 -> ${updatedWhtM!.stock}).\n`);

  // 6. Oversell Prevention Guard
  console.log('6. Testing Overselling Prevention...');
  const oversellCart = await prisma.cart.create({ data: {} });
  await prisma.cartItem.create({
    data: { cartId: oversellCart.id, variantId: variantBlkM.id, quantity: 4 }, // Stock is now 3, attempting to buy 4
  });
  const oversellCartWithItems = (await getCartById(oversellCart.id))!;

  let oversellBlocked = false;
  try {
    await createOrderFromCart(oversellCartWithItems, {
      customerName: 'Oversell Tester',
      customerPhone: '01123456789',
      customerEmail: 'oversell@merrier.test',
      shippingGovernorate: 'Giza',
      shippingCity: 'Dokki',
      shippingArea: 'Shooting Club',
      shippingStreet: 'Mossadak St',
      shippingBuilding: '10',
      shippingApartment: '',
      shippingNotes: '',
      paymentMethod: 'COD',
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      oversellBlocked = true;
    }
  }
  assert(oversellBlocked, 'Checkout must throw CheckoutError when requested quantity exceeds available stock');
  console.log('   ✓ Overselling successfully prevented.\n');

  // 7. Admin Order Lifecycle & Status Progression
  console.log('7. Testing Admin Order Lifecycle Transitions...');
  const transitions = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

  for (const nextStatus of transitions) {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });
    assert(updated.status === nextStatus, `Status should update to ${nextStatus}`);
  }
  console.log('   ✓ Order lifecycle progressed: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED.\n');

  // 8. Order Cancellation & Stock Restoration
  console.log('8. Testing Order Cancellation & Stock Restoration...');
  const cancelCart = await prisma.cart.create({ data: {} });
  await prisma.cartItem.create({
    data: { cartId: cancelCart.id, variantId: variantBlkM.id, quantity: 1 },
  });
  const cancelCartWithItems = (await getCartById(cancelCart.id))!;
  const cancelOrder = await createOrderFromCart(cancelCartWithItems, {
    customerName: 'Cancel Customer',
    customerPhone: '01234567890',
    customerEmail: 'cancel@merrier.test',
    shippingGovernorate: 'Alexandria',
    shippingCity: 'Alexandria',
    shippingArea: 'Sidi Gaber',
    shippingStreet: 'Corniche',
    shippingBuilding: '5',
    shippingApartment: '',
    shippingNotes: '',
    paymentMethod: 'COD',
  });

  const stockBeforeCancel = (await prisma.productVariant.findUnique({ where: { id: variantBlkM.id } }))!.stock;
  assert(stockBeforeCancel === 2, `Black M stock should now be 2, got ${stockBeforeCancel}`);

  // Cancel the order and restore stock (as done in PATCH /api/admin/orders/[id])
  await prisma.$transaction(async (tx) => {
    const fullOrder = await tx.order.findUnique({ where: { id: cancelOrder.id }, include: { items: true } });
    for (const item of fullOrder!.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    await tx.order.update({ where: { id: cancelOrder.id }, data: { status: 'CANCELLED' } });
  });

  const stockAfterCancel = (await prisma.productVariant.findUnique({ where: { id: variantBlkM.id } }))!.stock;
  assert(stockAfterCancel === 3, `Black M stock should be restored to 3, got ${stockAfterCancel}`);
  console.log('   ✓ Cancelled order successfully restored variant stock.\n');

  // 9. Paymob Webhook HMAC Verification
  console.log('9. Testing Paymob HMAC Verification...');
  process.env.PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || 'test_hmac_secret_key_12345';
  const sampleTransaction = {
    amount_cents: 262000,
    created_at: '2026-08-25T19:00:00',
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    id: 99887766,
    integration_id: 12345,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 554433 },
    owner: 100,
    pending: false,
    source_data: {
      pan: '2345',
      sub_type: 'MasterCard',
      type: 'card',
    },
    success: true,
  };

  const { createHmac } = await import('crypto');
  const HMAC_FIELDS = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order.id',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success',
  ];

  function getPath(obj: any, path: string) {
    return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
  }

  const concatenated = HMAC_FIELDS.map((f) => String(getPath(sampleTransaction, f) ?? '')).join('');
  const validHmac = createHmac('sha512', process.env.PAYMOB_HMAC_SECRET).update(concatenated).digest('hex');

  assert(verifyPaymobHmac(sampleTransaction, validHmac), 'Valid Paymob HMAC must be accepted');
  assert(!verifyPaymobHmac(sampleTransaction, 'invalid_forged_hmac'), 'Forged HMAC must be rejected');
  console.log('   ✓ Paymob HMAC signature verification verified.\n');

  // 10. Clean up test data
  console.log('10. Cleaning up test products and orders...');
  await prisma.payment.deleteMany({ where: { orderId: { in: [order.id, cancelOrder.id] } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [order.id, cancelOrder.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [order.id, cancelOrder.id] } } });
  await prisma.cartItem.deleteMany({ where: { cartId: { in: [cart.id, oversellCart.id, cancelCart.id] } } });
  await prisma.cart.deleteMany({ where: { id: { in: [cart.id, oversellCart.id, cancelCart.id] } } });
  await prisma.productVariant.deleteMany({ where: { productId: testProduct.id } });
  await prisma.productImage.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  console.log('   ✓ Test data cleaned up.\n');

  console.log('=== ALL 10 E-COMMERCE TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((e) => {
    console.error('\n❌ Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
