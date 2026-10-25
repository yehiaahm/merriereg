import { prisma } from '@/lib/prisma';
import { parseStoredChart } from './chart-schema';
import type { SizeChartData } from './measurements';

/**
 * The chart Find My Size uses for a product: the product's own chart if it
 * has one, otherwise its category's. Returns null — meaning "no
 * recommendation" — when there is no chart, the chart isn't marked verified,
 * or its stored data fails validation. A product with its own *unverified*
 * chart deliberately does not fall back to the category chart: someone chose
 * that chart for this product, and it isn't ready.
 */
export async function getSizeChartForProduct(productId: string): Promise<SizeChartData | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      sizeChart: true,
      category: { select: { sizeChart: true } },
    },
  });
  const row = product?.sizeChart ?? product?.category?.sizeChart ?? null;
  if (!row || !row.verified) return null;
  return parseStoredChart(row);
}

export function listSizeCharts() {
  return prisma.sizeChart.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true, categories: true } } },
  });
}
