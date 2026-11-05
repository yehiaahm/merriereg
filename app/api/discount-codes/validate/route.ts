import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentCart } from '@/lib/cart';
import { checkDiscountCode } from '@/lib/discount-codes';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ code: z.string().trim().min(1).max(40) });

/**
 * Lets the checkout page check a typed promo code. Returns the pricing rule so
 * the browser can show a live estimate; the order itself is always re-priced
 * and re-validated on the server (lib/orders.ts). Rate-limited so the code
 * space can't be brute-forced.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(req, 'discount-validate', 20, 60_000)) {
    return NextResponse.json({ valid: false, message: 'Too many attempts. Please wait a minute.' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: 'Enter a promo code.' }, { status: 400 });
  }

  // Only answer inside a real shopping session.
  const cart = await getCurrentCart();
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ valid: false, message: 'Your cart is empty.' }, { status: 400 });
  }

  const check = await checkDiscountCode(prisma, parsed.data.code);
  if (!check.ok) return NextResponse.json({ valid: false, message: check.message });

  return NextResponse.json({ valid: true, rule: check.rule });
}
