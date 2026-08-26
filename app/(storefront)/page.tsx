import Link from 'next/link';
import { listActiveProducts } from '@/lib/products';
import { getCurrentWishlist, wishlistedProductIds } from '@/lib/wishlist';
import { ProductCard } from '@/components/ProductCard';
import { FeaturedProductShowcase } from '@/components/FeaturedProductShowcase';
import { HeroVisual } from '@/components/HeroVisual';
import { MarqueeStrip } from '@/components/MarqueeStrip';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [products, wishlist] = await Promise.all([listActiveProducts(), getCurrentWishlist()]);
  const featured = products.slice(0, 8);
  const wishlistedIds = wishlistedProductIds(wishlist);

  return (
    <main>
      {/* 1. HERO SECTION WITH ICONIC DOTMARK LOGO */}
      <section className="mr-hero">
        <div className="mr-hero-grid">
          <div className="mr-hero-copy reveal" data-reveal>
            <div className="mr-hero-tagbar">
              <span className="mr-eyebrow">Est. 2024 &middot; Essentials-First Streetwear</span>
            </div>
            <h1 className="mr-h1 mr-hero-title" id="mrHeroTitle">
              <span className="mr-line-mask">
                <span className="mr-line" style={{ transitionDelay: '0.05s' }}>
                  Choose
                </span>
              </span>
              <span className="mr-line-mask">
                <span className="mr-line" style={{ transitionDelay: '0.16s' }}>
                  Your
                </span>
              </span>
              <span className="mr-line-mask">
                <span className="mr-line" style={{ transitionDelay: '0.27s' }}>
                  Merrier
                </span>
              </span>
            </h1>
            <p className="mr-lede">
              Elevated essentials and statement silhouettes, built for the everyday and the extraordinary. This winter,
              MERRIER begins a new era.
            </p>
            <div className="mr-hero-actions">
              <Link className="mr-btn-primary" href="#collection">
                View the Collection &rarr;
              </Link>
              <a className="mr-btn-ghost" href="https://instagram.com/merriereg" target="_blank" rel="noopener">
                Follow @merriereg
              </a>
            </div>
          </div>

          <HeroVisual />
        </div>

        <div className="mr-scrollcue">
          <span>SCROLL</span>
          <div className="mr-scrollcue-line" />
        </div>
      </section>

      {/* 2. MIDDLE MARQUEE TICKER */}
      <MarqueeStrip />

      {/* 3. SHOWCASE / COLLECTION SECTION (LIVE PRODUCTS FROM DATABASE) */}
      <section className="mr-showcase" id="collection">
        <div className="mr-container">
          {featured[0] ? (
            <FeaturedProductShowcase
              badgeLabel="Coming This Winter"
              heading="The New Era"
              lede="A new chapter of elevated essentials and statement silhouettes — the piece that opens the MERRIER winter lineup."
              product={featured[0]}
              isWishlisted={wishlistedIds.has(featured[0].id)}
            />
          ) : (
            <div className="mr-showcase-head">
              <div className="reveal" data-reveal>
                <span className="mr-badge">
                  <i />
                  Coming This Winter
                </span>
                <h2 className="mr-h2" style={{ marginTop: 18 }}>
                  The New Era
                </h2>
              </div>
              <p className="mr-lede reveal" data-reveal style={{ paddingBottom: 6 }}>
                New arrivals are on their way — check back soon.
              </p>
            </div>
          )}

          {featured.length > 1 && (
            <div className="mr-grid" style={{ marginTop: 64 }}>
              {featured.slice(1).map((product, idx) => (
                <ProductCard key={product.id} product={product} index={idx + 1} isWishlisted={wishlistedIds.has(product.id)} />
              ))}
            </div>
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

      {/* 4. ABOUT BRAND STORY SECTION (WITH WATERMARK 24) */}
      <section className="mr-about" id="about">
        <div className="mr-about-num">24</div>
        <div className="mr-container mr-about-grid">
          <p className="mr-h2 mr-about-quote reveal" data-reveal>
            Merrier is built for those who dress with <em>intention</em> — essentials with an edge, made for the
            everyday and the extraordinary.
          </p>
          <div className="mr-about-side reveal" data-reveal>
            <div className="mr-about-row">
              <span className="mr-eyebrow">Founded</span>
              <p>
                Started in 2024 as a small drop-based label — every piece designed around a single idea: choose your
                Merrier.
              </p>
            </div>
            <div className="mr-about-row">
              <span className="mr-eyebrow">Approach</span>
              <p>Essentials-first. Fewer pieces, made with weight, cut and fabric that hold up to daily rotation.</p>
            </div>
            <div className="mr-about-row">
              <span className="mr-eyebrow">Now</span>
              <p>The New Era — MERRIER&apos;s first full winter collection — opens this season.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA DROP SECTION */}
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
