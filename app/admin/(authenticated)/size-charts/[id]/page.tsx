import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { listCategories } from '@/lib/products';
import { SizeChartForm, type SizeChartFormValue } from '@/components/admin/SizeChartForm';
import { sizeChartInputSchema } from '@/lib/sizing/chart-schema';
import { MEASUREMENT_KEYS, type MeasurementKey } from '@/lib/sizing/measurements';

export const metadata = { title: 'Admin — Edit Size Chart' };
export const dynamic = 'force-dynamic';

const str = (n: number) => String(n);

export default async function EditSizeChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [chart, categories] = await Promise.all([
    prisma.sizeChart.findUnique({ where: { id }, include: { categories: { select: { id: true } } } }),
    listCategories(),
  ]);
  if (!chart) notFound();

  // Stored JSON that no longer passes validation is shown as-is minus the
  // invalid bits, so the admin can repair it rather than losing the chart.
  const parsed = sizeChartInputSchema.safeParse({
    name: chart.name,
    basis: chart.basis,
    garmentFlat: chart.garmentFlat,
    fit: chart.fit,
    stretch: chart.stretch,
    notes: chart.notes,
    source: chart.source,
    verified: chart.verified,
    sizes: chart.sizes,
    ease: chart.ease,
  });
  const rawSizes = (Array.isArray(chart.sizes) ? chart.sizes : []) as {
    size?: string;
    measurements?: Partial<Record<MeasurementKey, { min: number; max: number }>>;
  }[];
  const rawEase = (chart.ease ?? {}) as Partial<Record<MeasurementKey, { min: number; max: number }>>;

  const columns = MEASUREMENT_KEYS.filter((k) => rawSizes.some((r) => r.measurements?.[k]));
  const initial: SizeChartFormValue = {
    id: chart.id,
    name: chart.name,
    basis: chart.basis === 'GARMENT' ? 'GARMENT' : 'BODY',
    garmentFlat: chart.garmentFlat,
    fit: (chart.fit as SizeChartFormValue['fit']) ?? null,
    stretch: (chart.stretch as SizeChartFormValue['stretch']) ?? null,
    source: chart.source ?? '',
    notes: chart.notes ?? '',
    // A chart that fails validation can't stay verified.
    verified: chart.verified && parsed.success,
    columns,
    rows: rawSizes.map((r) => ({
      size: r.size ?? '',
      values: Object.fromEntries(
        columns.filter((k) => r.measurements?.[k]).map((k) => [k, { min: str(r.measurements![k]!.min), max: str(r.measurements![k]!.max) }])
      ),
    })),
    ease: Object.fromEntries(
      MEASUREMENT_KEYS.filter((k) => rawEase[k]).map((k) => [k, { min: str(rawEase[k]!.min), max: str(rawEase[k]!.max) }])
    ),
    categoryIds: chart.categories.map((c) => c.id),
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Edit Size Chart</h1>
      <SizeChartForm initial={initial} categories={categories} />
    </div>
  );
}
