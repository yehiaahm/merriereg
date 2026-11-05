import { z } from 'zod';

// Request body for creating/updating a discount code from the admin form.
// Amounts arrive in piastres (the form converts EGP → piastres).
const optionalDate = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date.' });
      return z.NEVER;
    }
    return d;
  });

const optionalPositiveInt = (message: string) =>
  z
    .number()
    .int(message)
    .min(1, message)
    .max(100_000_000, message)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const discountCodeRequestSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{3,30}$/, 'Code must be 3–30 characters: letters, numbers, dot, dash or underscore.'),
    label: z.string().trim().max(80, 'Description is too long (max 80).').optional().or(z.literal('')),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().int('Discount value must be a whole number.').min(1, 'Discount value must be at least 1.'),
    maxDiscount: optionalPositiveInt('Maximum discount must be a positive amount.'),
    minSubtotal: z.number().int().min(0, 'Minimum order cannot be negative.').max(100_000_000).default(0),
    usageLimit: optionalPositiveInt('Usage limit must be a whole number of at least 1.'),
    oncePerCustomer: z.boolean().default(false),
    startsAt: optionalDate,
    expiresAt: optionalDate,
    active: z.boolean().default(true),
    showInBar: z.boolean().default(false),
    showAtCheckout: z.boolean().default(true),
    barText: z.string().trim().max(120, 'Bar text is too long (max 120).').optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PERCENT' && data.value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A percentage discount cannot exceed 100%.', path: ['value'] });
    }
    if (data.type === 'FIXED' && data.maxDiscount !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maximum discount only applies to percentage codes.',
        path: ['maxDiscount'],
      });
    }
    if (data.startsAt && data.expiresAt && data.expiresAt <= data.startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be after the start date.', path: ['expiresAt'] });
    }
  });

export type DiscountCodeInput = z.infer<typeof discountCodeRequestSchema>;
