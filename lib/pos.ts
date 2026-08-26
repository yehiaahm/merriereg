import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/orders';

export class PosSaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PosSaleError';
  }
}

export interface PosSaleInput {
  items: { variantId: string; quantity: number }[];
  discountPiastres: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod: 'POS_CASH' | 'POS_CARD';
  cashierId: string;
}

/**
 * Creates a real, immediately-paid Order from an in-store POS sale — same
 * Products/Variants/Inventory/Orders tables as the online storefront, no
 * separate POS data model. Re-validates and atomically decrements stock
 * inside one transaction exactly like online checkout (lib/orders.ts), so
 * a POS sale and a web checkout can never oversell the same variant against
 * each other.
 */
export async function createPosSale(input: PosSaleInput) {
  if (input.items.length === 0) {
    throw new PosSaleError('Add at least one item to the sale.');
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

    for (const item of input.items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } },
      });

      if (!variant || !variant.active || variant.product.status === 'ARCHIVED') {
        throw new PosSaleError(`"${variant?.product.name ?? 'An item'}" is no longer available.`);
      }
      if (variant.stock < item.quantity) {
        throw new PosSaleError(
          `Only ${variant.stock} left of "${variant.product.name}" (${variant.size} / ${variant.color}).`
        );
      }

      const decremented = await tx.productVariant.updateMany({
        where: { id: variant.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (decremented.count === 0) {
        throw new PosSaleError(`"${variant.product.name}" just sold out.`);
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

    // Discount is a flat amount the cashier enters — clamp so total can
    // never go negative regardless of what was typed in.
    const discount = Math.max(0, Math.min(input.discountPiastres, subtotal));
    const total = subtotal - discount;

    let orderNumber = generateOrderNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await tx.order.findUnique({ where: { orderNumber } });
      if (!exists) break;
      orderNumber = generateOrderNumber();
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        // Goods are handed to the customer on the spot — there is no
        // separate shipping/fulfillment step for an in-store sale.
        status: 'DELIVERED',
        customerId: null,
        customerName: input.customerName?.trim() || 'Walk-in Customer',
        customerPhone: input.customerPhone?.trim() || '-',
        customerEmail: input.customerEmail?.trim() || null,
        // Required non-null fields on Order — an in-store sale has no
        // delivery address, so these are explicit placeholders rather than
        // a schema change that would ripple through the online checkout path.
        shippingGovernorate: 'In-Store',
        shippingCity: 'In-Store',
        shippingArea: 'In-Store',
        shippingStreet: 'In-Store Purchase',
        shippingBuilding: '-',
        shippingApartment: null,
        shippingNotes: `POS sale — cashier ${input.cashierId}`,
        subtotal,
        shippingCost: 0,
        discount,
        couponCode: null,
        total,
        paymentMethod: input.paymentMethod,
        // Payment is received immediately at the register, unlike COD/online.
        paymentStatus: 'PAID',
        items: { create: orderItemsData },
        payments: {
          create: {
            provider: input.paymentMethod,
            status: 'PAID',
            amount: total,
          },
        },
      },
      include: { items: true, payments: true },
    });

    return order;
  });
}
