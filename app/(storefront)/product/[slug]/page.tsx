import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/products';
import { getCurrentWishlist, wishlistedProductIds } from '@/lib/wishlist';
import { VariantSelector } from '@/components/VariantSelector';
import { WishlistButton } from '@/components/WishlistButton';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return { title: product.name, description: product.description.slice(0, 160) };
}

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || product.status !== 'ACTIVE') {
    notFound();
  }

  const wishlist = await getCurrentWishlist();
  const isWishlisted = wishlistedProductIds(wishlist).has(product.id);

  return (
    <main className="container" style={{ padding: '40px 24px 100px' }}>
      <VariantSelector productName={product.name} variants={product.variants} images={product.images} />

      <div style={{ marginTop: 20 }}>
        <WishlistButton productId={product.id} isWishlisted={isWishlisted} />
      </div>

      <section style={{ marginTop: 64, maxWidth: 800 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Description</h2>
        <p style={{ color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{product.description}</p>
      </section>
    </main>
  );
}
