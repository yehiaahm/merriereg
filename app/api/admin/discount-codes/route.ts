import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { discountCodeRequestSchema } from '@/lib/discount-codes-schema';
import { normalizeCouponCode } from '@/lib/promotions';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher — this second check is
// defense in depth, same as the other admin routes.
export async function GET() {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = discountCodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid discount code' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const created = await prisma.discountCode.create({
      data: {
        code: input.code,
        codeKey: normalizeCouponCode(input.code),
        label: input.label || null,
        type: input.type,
        value: input.value,
        maxDiscount: input.maxDiscount,
        minSubtotal: input.minSubtotal,
        usageLimit: input.usageLimit,
        oncePerCustomer: input.oncePerCustomer,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        active: input.active,
        showInBar: input.showInBar,
        showAtCheckout: input.showAtCheckout,
        barText: input.barText || null,
      },
    });
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'A discount code with that name already exists.' }, { status: 409 });
    }
    throw err;
  }
}
