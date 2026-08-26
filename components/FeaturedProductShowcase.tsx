'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatEGP } from '@/lib/money';
import { productPriceRange, productTotalStock } from '@/lib/products';
import { useWishlistToggle } from '@/components/useWishlistToggle';

type Variant = { price: number; compareAtPrice: number | null; active: boolean; stock: number };
type ProductImage = { url: string; altText: string | null };

type FeaturedProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category?: { name: string } | null;
  images: ProductImage[];
  variants: Variant[];
};

// Homepage marketing copy for the hero showcase — not stored on the
// product record, since the schema has no spec-tag field. Pass `specs` to
// override per drop.
const DEFAULT_SPECS = ['100% Cotton', 'Oversized Fit', 'Acid Wash', '260 GSM'];
const VALUE_POINTS = ['Premium Quality', 'Limited Drop', 'Winter Ready'];

function firstSentence(text: string) {
  const match = text.match(/^[^.]*\./);
  return (match ? match[0] : text).trim();
}

export function FeaturedProductShowcase({
  badgeLabel,
  heading,
  lede,
  product,
  specs = DEFAULT_SPECS,
  isWishlisted = false,
}: {
  badgeLabel: string;
  heading: string;
  lede: string;
  product: FeaturedProduct;
  specs?: string[];
  isWishlisted?: boolean;
}) {
  const { wishlisted, busy, toggle, Toast } = useWishlistToggle(product.id, isWishlisted);

  const images = product.images;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = images[activeImageIndex] ?? images[0];

  // Same auto-advance-then-stop-on-interaction behaviour as the rest of the
  // gallery surfaces on the site.
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const stopAutoplay = () => setIsAutoPlaying(false);

  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isAutoPlaying, images.length]);

  function selectImage(i: number) {
    stopAutoplay();
    setActiveImageIndex(i);
  }

  const { min, max, hasSale } = productPriceRange(product.variants);
  const totalStock = productTotalStock(product.variants);
  const outOfStock = totalStock === 0;
  const isLimited = !outOfStock && totalStock <= 12;
  const stockMessage = outOfStock ? 'Sold out' : isLimited ? 'Limited stock available' : 'In stock now';

  return (
    <div className="mr-feature">
      <div className="mr-feature-top">
        <div className="mr-feature-copy reveal" data-reveal>
          <span className="mr-badge">
            <i />
            {badgeLabel}
          </span>
          <h2 className="mr-h2" style={{ marginTop: 18 }}>
            {heading}
          </h2>
          <p className="mr-lede" style={{ marginTop: 16 }}>
            {lede}
          </p>
          <ul className="mr-feature-values">
            {VALUE_POINTS.map((point) => (
              <li key={point}>
                <span className="mr-feature-value-dot" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="mr-feature-gallery reveal" data-reveal>
          <div className="mr-feature-hero" onPointerDown={stopAutoplay}>
            {activeImage ? (
              <Image
                key={activeImage.url}
                src={activeImage.url}
                alt={activeImage.altText ?? product.name}
                fill
                sizes="(max-width: 900px) 100vw, 60vw"
                style={{ objectFit: 'cover' }}
                className="mr-gallery-image"
                priority
              />
            ) : (
              <div className="mr-feature-hero-empty">MERRIER</div>
            )}
            {outOfStock && (
              <span className="badge badge-out" style={{ position: 'absolute', top: 16, left: 16, zIndex: 2 }}>
                Sold Out
              </span>
            )}
            {hasSale && !outOfStock && (
              <span className="badge badge-sale" style={{ position: 'absolute', top: 16, left: 16, zIndex: 2 }}>
                Sale
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="mr-feature-thumbs">
              {images.map((img, i) => (
                <button
                  key={img.url + i}
                  onClick={() => selectImage(i)}
                  className={`mr-feature-thumb${i === activeImageIndex ? ' mr-feature-thumb--active' : ''}`}
                  aria-label={`Show image ${i + 1}`}
                  aria-pressed={i === activeImageIndex}
                >
                  <Image src={img.url} alt="" fill sizes="90px" style={{ objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mr-feature-panel reveal" data-reveal>
        <div className="mr-feature-panel-info">
          <span className="mr-card-index">01 &middot; {product.category?.name ?? 'Essentials'}</span>
          <h3 className="mr-feature-panel-name">{product.name}</h3>
          <p className="mr-feature-panel-desc">{firstSentence(product.description)}</p>
          <div className="mr-feature-specs">
            {specs.map((spec) => (
              <span key={spec} className="mr-feature-spec">
                {spec}
              </span>
            ))}
          </div>
        </div>

        <div className="mr-feature-panel-cta">
          <span className="mr-feature-price">{min === max ? formatEGP(min) : `${formatEGP(min)} – ${formatEGP(max)}`}</span>
          <span className={`mr-feature-stock${outOfStock ? ' mr-feature-stock--out' : ''}`}>{stockMessage}</span>
          <div className="mr-feature-actions">
            <Link href={`/product/${product.slug}`} className="mr-btn-primary">
              View Details &rarr;
            </Link>
            <button type="button" className="mr-btn-ghost" onClick={toggle} disabled={busy}>
              {wishlisted ? 'In Wishlist ♥' : 'Add to Wishlist ♡'}
            </button>
          </div>
        </div>
      </div>
      {Toast}
    </div>
  );
}
