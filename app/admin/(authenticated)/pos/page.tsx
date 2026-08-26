import { listActiveProducts } from '@/lib/products';
import { POSTerminal } from '@/components/admin/POSTerminal';

export const metadata = { title: 'Point of Sale' };
export const dynamic = 'force-dynamic';

export default async function AdminPOSPage() {
  const products = await listActiveProducts();

  const posProducts = products
    .filter((p) => p.variants.some((v) => v.active))
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.images[0]?.url ?? null,
      variants: p.variants
        .filter((v) => v.active)
        .map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          sku: v.sku,
          price: v.price,
          stock: v.stock,
        })),
    }));

  return <POSTerminal products={posProducts} />;
}
