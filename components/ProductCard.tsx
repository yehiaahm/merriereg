'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatEGP } from '@/lib/money';
import { productPriceRange, productTotalStock } from '@/lib/products';
import { useWishlistToggle } from '@/components/useWishlistToggle';

type CardProduct = {
  id?: string;
  slug: string;
  name: string;
  category?: { name: string } | null;
  images: { url: string; altText: string | null }[];
  variants: { price: number; compareAtPrice: number | null; active: boolean; stock: number }[];
};

export function ProductCard({
  product,
  index,
  isWishlisted = false,
}: {
  product: CardProduct;
  index?: number;
  isWishlisted?: boolean;
}) {
  const { wishlisted, busy, toggle, Toast } = useWishlistToggle(product.id!, isWishlisted);
  const { min, max, hasSale } = productPriceRange(product.variants);
  const totalStock = productTotalStock(product.variants);
  const outOfStock = totalStock === 0;
  const idxStr = index !== undefined ? String(index + 1).padStart(2, '0') : null;

  const images = product.images;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const image = images[activeImageIndex] ?? images[0];

  // Auto-advance the card image every 4s, same as the product page gallery;
  // hovering/touching the card stops it so the image doesn't change under a
  // visitor who's actively looking at it.
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

  return (
    <>
    <Link
      href={`/product/${product.slug}`}
      className="mr-card"
      onMouseEnter={stopAutoplay}
      onTouchStart={stopAutoplay}
    >
      <div className="mr-card-icon">
        {image ? (
          <Image
            key={image.url}
            src={image.url}
            alt={image.altText ?? product.name}
            fill
            sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 25vw"
            style={{ objectFit: 'cover', transition: 'transform 0.4s ease' }}
            className="mr-gallery-image"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-soft)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            MERRIER
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, zIndex: 2 }}>
          {hasSale && <span className="badge badge-sale">Sale</span>}
          {outOfStock && <span className="badge badge-out">Sold Out</span>}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wishlisted}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.85)',
            color: wishlisted ? 'var(--accent)' : 'var(--ink)',
            fontSize: 15,
            lineHeight: 1,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {wishlisted ? '♥' : '♡'}
        </button>
        {images.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 5,
              zIndex: 2,
            }}
          >
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: i === activeImageIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="mr-card-index">
          {idxStr ? `${idxStr} · ` : ''}
          {product.category?.name ?? 'Essentials'}
        </div>
        <div className="mr-card-name" style={{ marginTop: 4 }}>
          {product.name}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--line)',
          paddingTop: 12,
          marginTop: 'auto',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
          {min === max ? formatEGP(min) : `${formatEGP(min)} – ${formatEGP(max)}`}
        </span>
        <span className="mr-eyebrow" style={{ fontSize: 11, color: 'var(--accent)' }}>
          View &rarr;
        </span>
      </div>
    </Link>
    {Toast}
    </>
  );
}
