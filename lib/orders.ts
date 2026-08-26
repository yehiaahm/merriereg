import { prisma } from '@/lib/prisma';
import { calculateShippingCost } from '@/lib/shipping';
import { calculateCartDiscount, isFollowCouponValid } from '@/lib/promotions';
import type { CartWithItems } from '@/lib/cart';
import type { z } from 'zod';
import type { checkoutSchema } from '@/lib/validation';

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MR${y}${m}${d}-${random}`;
}

type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Creates a real order from a cart, inside a single transaction:
 *  - re-reads every variant fresh from the DB (never trusts cart snapshot
 *    prices, since they may be stale)
 *  - re-validates stock for every line, atomically decrementing it
 *  - computes subtotal/shipping/total on the server
 *  - empties the cart only after the order is safely created
 *
 * Throws CheckoutError with a user-facing message on any validation failure
 * (empty cart, unavailable variant, insufficient stock). The transaction
 * guarantees no partial state — either the whole order + stock decrement
 * succeeds, or nothing changes.
 */
export async function createOrderFromCart(cart: CartWithItems, input: CheckoutInput, customerId?: string | null) {
  if (cart.items.length === 0) {
    throw new CheckoutError('Your cart is empty.');
  }

  return prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const orderItemsData: {
      variantId: string;
      productName: string;
      variantSize: string;
      variantColor: string;
      sku: string;
      imageUrl: string | null;
      unitPrice: number;
      quantity: number;
      subtotal: number;
    }[] = [];

    for (const item of cart.items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } },
      });

      if (!variant || !variant.active || variant.product.status !== 'ACTIVE') {
        throw new CheckoutError(`"${variant?.product.name ?? 'An item'}" is no longer available.`);
      }
      if (variant.stock < item.quantity) {
        throw new CheckoutError(
          `Only ${variant.stock} left of "${variant.product.name}" (${variant.size} / ${variant.color}). Please update your cart.`
        );
      }

      const decremented = await tx.productVariant.updateMany({
        where: { id: variant.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (decremented.count === 0) {
        // Someone else bought the remaining stock between our read and this
        // write — fail the whole checkout rather than oversell.
        throw new CheckoutError(`"${variant.product.name}" just sold out. Please update your cart.`);
      }

      const lineSubtotal = variant.price * item.quantity;
      subtotal += lineSubtotal;
      orderItemsData.push({
        variantId: variant.id,
        productName: variant.product.name,
        variantSize: variant.size,
        variantColor: variant.color,
        sku: variant.sku,
        imageUrl: variant.product.images[0]?.url ?? null,
        unitPrice: variant.price,
        quantity: item.quantity,
        subtotal: lineSubtotal,
      });
    }

    if (input.couponCode && !isFollowCouponValid(input.couponCode)) {
      throw new CheckoutError('That promo code is not valid.');
    }

    const promo = calculateCartDiscount(
      orderItemsData.map((item) => ({ price: item.unitPrice, quantity: item.quantity })),
      input.couponCode
    );
    const discount = promo.totalDiscount;
    const couponCode = promo.couponApplied ? input.couponCode!.trim().toUpperCase() : null;

    const shippingCost = calculateShippingCost(input.shippingGovernorate);
    const total = subtotal + shippingCost - discount;

    let orderNumber = generateOrderNumber();
    // Extremely unlikely collision guard.
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await tx.order.findUnique({ where: { orderNumber } });
      if (!exists) break;
      orderNumber = generateOrderNumber();
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        status: 'PENDING',
        customerId: customerId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail || null,
        shippingGovernorate: input.shippingGovernorate,
        shippingCity: input.shippingCity,
        shippingArea: input.shippingArea,
        shippingStreet: input.shippingStreet,
        shippingBuilding: input.shippingBuilding,
        shippingApartment: input.shippingApartment || null,
        shippingNotes: input.shippingNotes || null,
        subtotal,
        shippingCost,
        discount,
        couponCode,
        total,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PENDING',
        items: { create: orderItemsData },
        payments: {
          create: {
            provider: input.paymentMethod,
            status: 'PENDING',
            amount: total,
          },
        },
      },
      include: { items: true, payments: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  });
}
