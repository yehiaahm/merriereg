import { ProductForm } from '@/components/admin/ProductForm';
import { listCategories } from '@/lib/products';

export const metadata = { title: 'Admin — New Product' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Add Product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
