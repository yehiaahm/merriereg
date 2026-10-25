import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { sizeChartRequestSchema } from '@/lib/sizing/chart-schema';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const chart = await prisma.sizeChart.findUnique({ where: { id }, include: { categories: { select: { id: true } } } });
  if (!chart) return NextResponse.json({ error: 'Size chart not found' }, { status: 404 });
  return NextResponse.json({ chart });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sizeChartRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid size chart' }, { status: 400 });
  }
  const { categoryIds, ...input } = parsed.data;

  const existing = await prisma.sizeChart.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Size chart not found' }, { status: 404 });

  const chart = await prisma.$transaction(async (tx) => {
    const updated = await tx.sizeChart.update({
      where: { id },
      data: {
        name: input.name,
        basis: input.basis,
        garmentFlat: input.basis === 'GARMENT' && input.garmentFlat,
        fit: input.fit,
        stretch: input.stretch,
        notes: input.notes || null,
        source: input.source || null,
        verified: input.verified,
        sizes: input.sizes,
        ease: input.basis === 'GARMENT' ? input.ease : {},
      },
    });
    // Categories not listed any more stop using this chart; listed ones switch to it.
    await tx.category.updateMany({ where: { sizeChartId: id, id: { notIn: categoryIds } }, data: { sizeChartId: null } });
    if (categoryIds.length > 0) {
      await tx.category.updateMany({ where: { id: { in: categoryIds } }, data: { sizeChartId: id } });
    }
    return updated;
  });

  return NextResponse.json({ chart });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.sizeChart.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Size chart not found' }, { status: 404 });

  // Products/categories using it fall back to "no chart" (onDelete: SetNull),
  // which simply hides Find My Size for them.
  await prisma.sizeChart.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
