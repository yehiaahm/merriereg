import { SizeChartForm } from '@/components/admin/SizeChartForm';
import { listCategories } from '@/lib/products';

export const metadata = { title: 'Admin — New Size Chart' };
export const dynamic = 'force-dynamic';

export default async function NewSizeChartPage() {
  const categories = await listCategories();
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Add Size Chart</h1>
      <SizeChartForm categories={categories} />
    </div>
  );
}
