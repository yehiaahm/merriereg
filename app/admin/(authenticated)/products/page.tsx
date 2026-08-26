import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import { productPriceRange, productTotalStock } from '@/lib/products';

export const metadata = { title: 'Admin — Products' };
export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28 }}>Products</h1>
        <Link href="/admin/products/new" className="btn btn-primary">
          + Add Product
        </Link>
      </div>

      <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Variants</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const { min, max } = productPriceRange(p.variants);
            const stock = productTotalStock(p.variants);
            return (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  <span className="badge badge-status">{p.status}</span>
                </td>
                <td>{min === max ? formatEGP(min) : `${formatEGP(min)}–${formatEGP(max)}`}</td>
                <td>{stock === 0 ? <span style={{ color: 'var(--danger)' }}>0</span> : stock}</td>
                <td>{p.variants.length}</td>
                <td>
                  <Link href={`/admin/products/${p.id}`} style={{ fontSize: 13, fontWeight: 700 }}>
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: 'var(--ink-soft)' }}>
                No products yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
