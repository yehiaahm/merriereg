import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { sizeChartRequestSchema } from '@/lib/sizing/chart-schema';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher — this second check is
// defense in depth, same as the other admin routes.
export async function GET() {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const charts = await prisma.sizeChart.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ charts });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = sizeChartRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid size chart' }, { status: 400 });
  }
  const { categoryIds, ...input } = parsed.data;

  const chart = await prisma.$transaction(async (tx) => {
    const created = await tx.sizeChart.create({
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
    if (categoryIds.length > 0) {
      await tx.category.updateMany({ where: { id: { in: categoryIds } }, data: { sizeChartId: created.id } });
    }
    return created;
  });

  return NextResponse.json({ chart }, { status: 201 });
}
