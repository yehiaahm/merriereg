import Link from 'next/link';
import { listActiveProducts, listCategories, productPriceRange } from '@/lib/products';
import { getCurrentWishlist, wishlistedProductIds } from '@/lib/wishlist';
import { ProductCard } from '@/components/ProductCard';
import { ShopSort } from '@/components/ShopSort';
import { parseSort } from '@/lib/shop-sort';

export const metadata = { title: 'Shop' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);

  const [listed, categories, wishlist] = await Promise.all([
    listActiveProducts({ categorySlug: category }),
    listCategories(),
    getCurrentWishlist(),
  ]);
  const wishlistedIds = wishlistedProductIds(wishlist);

  // listActiveProducts already returns the default order: the featured products
  // first (FEATURED_PRODUCT_SLUGS in lib/products.ts), then newest first.
  const products =
    sort === 'newest'
      ? listed
      : [...listed].sort((a, b) => {
          const diff = productPriceRange(a.variants).min - productPriceRange(b.variants).min;
          return sort === 'price-asc' ? diff : -diff;
        });

  const activeCategory = categories.find((c) => c.slug === category);
  const tabHref = (slug?: string) => {
    const params = new URLSearchParams();
    if (slug) params.set('category', slug);
    if (sort !== 'newest') params.set('sort', sort);
    const qs = params.toString();
    return qs ? `/products?${qs}` : '/products';
  };

  return (
    <main className="mr-shop">
      <header className="mr-shop-head">
        <div>
          <span className="mr-eyebrow">Essentials &middot; Streetwear</span>
          <h1 className="mr-h1 mr-shop-title">{activeCategory ? activeCategory.name : 'The Shop'}</h1>
        </div>
        <p className="mr-shop-count">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'}
        </p>
      </header>

      <div className="mr-shop-bar">
        {categories.length > 0 ? (
          <nav className="mr-shop-tabs" aria-label="Categories">
            <Link href={tabHref()} aria-current={!category ? 'page' : undefined}>
              All
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={tabHref(c.slug)} aria-current={category === c.slug ? 'page' : undefined}>
                {c.name}
              </Link>
            ))}
          </nav>
        ) : (
          <span />
        )}
        <ShopSort sort={sort} category={category} />
      </div>

      {products.length === 0 ? (
        <div className="mr-shop-empty">
          <p className="mr-lede">
            {category ? 'No products found in this category.' : 'No products available right now. Check back soon.'}
          </p>
          {category && (
            <Link href="/products" className="mr-btn-primary">
              View all products
            </Link>
          )}
        </div>
      ) : (
        <div className="mr-product-grid">
          {products.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              isWishlisted={wishlistedIds.has(product.id)}
              priority={idx < 4}
            />
          ))}
        </div>
      )}
    </main>
  );
}
