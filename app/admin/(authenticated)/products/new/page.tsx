import { ProductForm } from '@/components/admin/ProductForm';
import { listCategories } from '@/lib/products';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Admin — New Product' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const [categories, sizeCharts] = await Promise.all([
    listCategories(),
    prisma.sizeChart.findMany({ select: { id: true, name: true, verified: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Add Product</h1>
      <ProductForm categories={categories} sizeCharts={sizeCharts} />
    </div>
  );
}
