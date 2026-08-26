import { z } from 'zod';
import { GOVERNORATES } from '@/lib/shipping';

export const addToCartSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

export const updateCartItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

export const removeCartItemSchema = z.object({
  itemId: z.string().min(1),
});

export const wishlistToggleSchema = z.object({
  productId: z.string().min(1),
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    let cleaned = val.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('+20')) cleaned = cleaned.slice(3);
    else if (cleaned.startsWith('0020')) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('+2')) cleaned = cleaned.slice(2);
    return cleaned;
  }, z.string().regex(/^01[0125][0-9]{8}$/, 'Enter a valid Egyptian phone number (e.g. 010xxxxxxxx or +2010xxxxxxxx)')),
  customerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  shippingGovernorate: z.enum(GOVERNORATES as unknown as [string, ...string[]]),
  shippingCity: z.string().trim().min(1).max(120),
  shippingArea: z.string().trim().min(1).max(120),
  shippingStreet: z.string().trim().min(1).max(200),
  shippingBuilding: z.string().trim().min(1).max(60),
  shippingApartment: z.string().trim().max(60).optional().or(z.literal('')),
  shippingNotes: z.string().trim().max(500).optional().or(z.literal('')),
  paymentMethod: z.enum(['COD', 'PAYMOB_CARD']),
  couponCode: z.string().trim().max(40).optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  // Paymob's billing_data requires an email; Cash on Delivery does not.
  if (data.paymentMethod === 'PAYMOB_CARD' && !data.customerEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email is required for online card payment.',
      path: ['customerEmail'],
    });
  }
});

export const customerSignupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  phone: z.preprocess((val) => {
    if (typeof val !== 'string' || val.trim() === '') return undefined;
    let cleaned = val.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('+20')) cleaned = cleaned.slice(3);
    else if (cleaned.startsWith('0020')) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('+2')) cleaned = cleaned.slice(2);
    return cleaned;
  }, z.string().regex(/^01[0125][0-9]{8}$/, 'Enter a valid Egyptian phone number (e.g. 010xxxxxxxx or +2010xxxxxxxx)').optional()),
});

export const customerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const variantInputSchema = z.object({
  id: z.string().optional(),
  size: z.string().trim().min(1).max(20),
  color: z.string().trim().min(1).max(40),
  colorHex: z.string().trim().max(20).optional().or(z.literal('')),
  sku: z.string().trim().min(1).max(60),
  priceEGP: z.number().positive(),
  compareAtPriceEGP: z.number().positive().optional().nullable(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens'),
  description: z.string().trim().min(1),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']),
  categoryId: z.string().optional().nullable(),
  newCategoryName: z.string().trim().max(80).optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        altText: z.string().optional(),
        colorValue: z.string().optional(),
      })
    )
    .default([]),
  variants: z.array(variantInputSchema).min(1, 'At least one variant is required'),
});

export const posSaleSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1, 'Add at least one item to the sale.'),
  discountEGP: z.number().min(0).optional(),
  customerName: z.string().trim().max(120).optional().or(z.literal('')),
  customerPhone: z.string().trim().max(30).optional().or(z.literal('')),
  customerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  paymentMethod: z.enum(['POS_CASH', 'POS_CARD']),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});
