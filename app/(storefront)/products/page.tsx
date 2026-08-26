import Link from 'next/link';
import { listActiveProducts, listCategories } from '@/lib/products';
import { getCurrentWishlist, wishlistedProductIds } from '@/lib/wishlist';
import { ProductCard } from '@/components/ProductCard';

export const metadata = { title: 'Shop' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories, wishlist] = await Promise.all([
    listActiveProducts({ categorySlug: category }),
    listCategories(),
    getCurrentWishlist(),
  ]);
  const wishlistedIds = wishlistedProductIds(wishlist);

  return (
    <main className="mr-container" style={{ padding: '60px 40px 120px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 48 }}>
        <div>
          <span className="mr-eyebrow">Essentials &middot; Streetwear</span>
          <h1 className="mr-h2" style={{ marginTop: 12 }}>
            The Shop
          </h1>
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/products"
              className={!category ? 'mr-btn-primary' : 'btn btn-outline'}
              style={{ padding: '10px 20px', minHeight: 38, fontSize: 11, letterSpacing: '0.12em' }}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className={category === c.slug ? 'mr-btn-primary' : 'btn btn-outline'}
                style={{ padding: '10px 20px', minHeight: 38, fontSize: 11, letterSpacing: '0.12em' }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <p className="mr-lede" style={{ color: 'var(--ink-soft)' }}>
          {category ? 'No products found in this category.' : 'No products available right now. Check back soon.'}
        </p>
      ) : (
        <div className="mr-grid">
          {products.map((product, idx) => (
            <ProductCard key={product.id} product={product} index={idx} isWishlisted={wishlistedIds.has(product.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
