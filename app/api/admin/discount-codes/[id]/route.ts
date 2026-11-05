import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { discountCodeRequestSchema } from '@/lib/discount-codes-schema';
import { normalizeCouponCode } from '@/lib/promotions';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
  return NextResponse.json({ code });
}

// Either a full edit (the form) or a quick `{ active: boolean }` toggle from the list.
const toggleSchema = z.object({ active: z.boolean() }).strict();

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const existing = await prisma.discountCode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });

  const toggle = toggleSchema.safeParse(body);
  if (toggle.success) {
    const code = await prisma.discountCode.update({ where: { id }, data: { active: toggle.data.active } });
    return NextResponse.json({ code });
  }

  const parsed = discountCodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid discount code' }, { status: 400 });
  }
  const input = parsed.data;

  if (input.usageLimit !== null && input.usageLimit < existing.usedCount) {
    return NextResponse.json(
      { error: `Usage limit cannot be lower than the ${existing.usedCount} times it has already been used.` },
      { status: 400 }
    );
  }

  try {
    const code = await prisma.discountCode.update({
      where: { id },
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
    return NextResponse.json({ code });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'A discount code with that name already exists.' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.discountCode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });

  // Past orders only keep the code as text, so deleting never alters order history.
  await prisma.discountCode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
