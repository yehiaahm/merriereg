import Link from 'next/link';
import { listActiveProducts } from '@/lib/products';
import { getCurrentWishlist, wishlistedProductIds } from '@/lib/wishlist';
import { ProductCard } from '@/components/ProductCard';
import { HeroVideo } from '@/components/HeroVideo';
import { MarqueeStrip } from '@/components/MarqueeStrip';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [products, wishlist] = await Promise.all([listActiveProducts(), getCurrentWishlist()]);
  const featured = products.slice(0, 8);
  const wishlistedIds = wishlistedProductIds(wishlist);

  return (
    <main>
      {/* 1. CINEMATIC VIDEO HERO */}
      <section className="mr-hero">
        <div className="mr-hero-copy">
          <span className="mr-eyebrow mr-hero-eyebrow">Est. 2024 &middot; Essentials-First Streetwear</span>
          <h1 className="mr-h1 mr-hero-title">
            <span className="mr-line-mask">
              <span className="mr-line" style={{ animationDelay: '0.2s' }}>
                Choose
              </span>
            </span>
            <span className="mr-line-mask">
              <span className="mr-line" style={{ animationDelay: '0.32s' }}>
                Your
              </span>
            </span>
            <span className="mr-line-mask">
              <span className="mr-line" style={{ animationDelay: '0.44s' }}>
                Merrier
              </span>
            </span>
          </h1>
          <p className="mr-lede mr-hero-lede">
            Elevated essentials and statement silhouettes, built for the everyday and the extraordinary.
          </p>
          <div className="mr-hero-actions">
            <Link className="mr-btn-hero" href="/products">
              Shop All
              <span className="mr-btn-hero-arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>

        <a className="mr-scrollcue" href="#collection" aria-label="Scroll to the collection">
          <span>SCROLL</span>
          <div className="mr-scrollcue-line" />
        </a>

        <HeroVideo />
      </section>

      {/* 2. MIDDLE MARQUEE TICKER */}
      <MarqueeStrip />

      {/* 3. COLLECTION (LIVE PRODUCTS FROM DATABASE) */}
      <section className="mr-showcase" id="collection">
        <div className="mr-container">
          {featured.length > 0 ? (
            <div className="mr-product-grid">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} isWishlisted={wishlistedIds.has(product.id)} />
              ))}
            </div>
          ) : (
            <p className="mr-lede reveal" data-reveal>
              New arrivals are on their way &mdash; check back soon.
            </p>
          )}

          {products.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Link href="/products" className="mr-btn-primary">
                View All Products &rarr;
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 4. CTA DROP SECTION */}
      <section className="mr-cta">
        <div className="mr-container mr-cta-inner">
          <span className="mr-badge reveal" data-reveal>
            <i />
            Stay Tuned
          </span>
          <h2 className="mr-h2 reveal" data-reveal>
            Be first to the drop.
          </h2>
          <p className="mr-lede reveal" data-reveal style={{ textAlign: 'center' }}>
            The New Era launches this winter. Follow along for release dates, restocks and behind-the-scenes.
          </p>
          <div className="mr-cta-actions reveal" data-reveal>
            <a
              className="mr-btn-primary"
              href="https://instagram.com/merriereg"
              target="_blank"
              rel="noopener"
            >
              Follow @merriereg &rarr;
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
