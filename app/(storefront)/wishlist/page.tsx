import Link from 'next/link';
import { getCurrentWishlist } from '@/lib/wishlist';
import { ProductCard } from '@/components/ProductCard';

export const metadata = { title: 'Your Wishlist' };
export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const wishlist = await getCurrentWishlist();
  const items = (wishlist?.items ?? []).filter((i) => i.product.status === 'ACTIVE');

  return (
    <main className="mr-container" style={{ padding: '60px 40px 120px' }}>
      <h1 className="mr-h2" style={{ marginBottom: 32 }}>
        Your Wishlist
      </h1>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p className="mr-lede" style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>
            Your wishlist is empty.
          </p>
          <Link href="/products" className="mr-btn-primary">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="mr-grid">
          {items.map((item, idx) => (
            <ProductCard key={item.id} product={item.product} index={idx} isWishlisted />
          ))}
        </div>
      )}
    </main>
  );
}
