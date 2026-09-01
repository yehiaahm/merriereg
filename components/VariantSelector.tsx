'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatEGP } from '@/lib/money';
import { useToast } from '@/components/AddToCartError';

type Variant = {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  active: boolean;
  sku: string;
};

type ProductImage = { url: string; altText: string | null; colorValue: string | null };

export function VariantSelector({
  productName,
  variants,
  images,
}: {
  productName: string;
  variants: Variant[];
  images: ProductImage[];
}) {
  const router = useRouter();
  const { show, Toast } = useToast();

  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color))), [variants]);
  const [selectedColor, setSelectedColor] = useState(colors[0] ?? '');

  const sizesForColor = useMemo(
    () => variants.filter((v) => v.color === selectedColor),
    [variants, selectedColor]
  );
  const [selectedSize, setSelectedSize] = useState(sizesForColor[0]?.size ?? '');

  const selectedVariant = useMemo(
    () => variants.find((v) => v.color === selectedColor && v.size === selectedSize) ?? null,
    [variants, selectedColor, selectedSize]
  );

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);

  const galleryImages = useMemo(() => {
    const colorMatch = images.filter((img) => img.colorValue === selectedColor);
    return colorMatch.length > 0 ? colorMatch : images;
  }, [images, selectedColor]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = galleryImages[activeImageIndex] ?? galleryImages[0];

  // Auto-advance the gallery every 4s; any user interaction with it stops
  // autoplay for good — a still image the visitor is actively looking at
  // shouldn't jump out from under them.
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const stopAutoplay = () => setIsAutoPlaying(false);

  useEffect(() => {
    if (!isAutoPlaying || galleryImages.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % galleryImages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isAutoPlaying, galleryImages.length]);

  function handleColorChange(color: string) {
    setSelectedColor(color);
    setActiveImageIndex(0);
    setIsAutoPlaying(true);
    const stillValid = variants.find((v) => v.color === color && v.size === selectedSize);
    if (!stillValid) {
      const firstForColor = variants.find((v) => v.color === color);
      setSelectedSize(firstForColor?.size ?? '');
    }
  }

  function selectImage(i: number) {
    stopAutoplay();
    setActiveImageIndex(i);
  }

  const isOutOfStock = !selectedVariant || !selectedVariant.active || selectedVariant.stock <= 0;
  const isLowStock = selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 3;

  async function handleAddToCart(shouldRedirect = false) {
    if (!selectedVariant || isOutOfStock || adding || buying) return;
    if (shouldRedirect) setBuying(true);
    else setAdding(true);

    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: selectedVariant.id, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        show(data.error ?? 'Could not add to cart.', 'error');
        return;
      }
      if (shouldRedirect) {
        router.push('/checkout');
      } else {
        show(`Added ${productName} (${selectedVariant.color} / ${selectedVariant.size}) to cart.`);
        router.refresh();
      }
    } catch {
      show('Network error — please try again.', 'error');
    } finally {
      setAdding(false);
      setBuying(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48 }} className="product-detail-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div
          onPointerDown={stopAutoplay}
          style={{
            position: 'relative',
            aspectRatio: '4 / 5',
            background: 'var(--cream-2)',
            border: '1px solid var(--line)',
            overflow: 'hidden',
          }}
        >
          {activeImage ? (
            <Image
              key={activeImage.url}
              src={activeImage.url}
              alt={activeImage.altText ?? productName}
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
              className="mr-gallery-image"
              priority
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
              }}
            >
              No image
            </div>
          )}
          {galleryImages.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 6,
                zIndex: 2,
              }}
            >
              {galleryImages.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
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
        {galleryImages.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {galleryImages.map((img, i) => (
              <button
                key={img.url + i}
                onClick={() => selectImage(i)}
                style={{
                  width: 64,
                  height: 80,
                  flexShrink: 0,
                  position: 'relative',
                  border: i === activeImageIndex ? '2px solid var(--accent)' : '1px solid var(--line)',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'none',
                }}
                aria-label={`Show image ${i + 1}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" style={{ objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>{productName}</h1>
          {selectedVariant && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{formatEGP(selectedVariant.price)}</span>
              {selectedVariant.compareAtPrice && selectedVariant.compareAtPrice > selectedVariant.price && (
                <span style={{ fontSize: 16, color: 'var(--ink-soft)', textDecoration: 'line-through' }}>
                  {formatEGP(selectedVariant.compareAtPrice)}
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <span className="eyebrow">Color: {selectedColor}</span>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {colors.map((color) => {
              const swatch = variants.find((v) => v.color === color);
              return (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  title={color}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: swatch?.colorHex || '#ccc',
                    border:
                      color === selectedColor ? '2px solid var(--accent)' : '1px solid var(--line)',
                    outline: color === selectedColor ? '2px solid var(--accent)' : 'none',
                    outlineOffset: 2,
                    cursor: 'pointer',
                  }}
                  aria-label={`Select color ${color}`}
                  aria-pressed={color === selectedColor}
                />
              );
            })}
          </div>
        </div>

        <div>
          <span className="eyebrow">Size</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {sizesForColor.map((v) => {
              const disabled = !v.active || v.stock <= 0;
              return (
                <button
                  key={v.id}
                  onClick={() => !disabled && setSelectedSize(v.size)}
                  disabled={disabled}
                  style={{
                    minWidth: 48,
                    minHeight: 44,
                    padding: '0 12px',
                    border:
                      v.size === selectedSize ? '2px solid var(--accent)' : '1px solid var(--line)',
                    background: disabled ? 'var(--cream-2)' : '#fff',
                    color: disabled ? 'var(--ink-soft)' : 'var(--ink)',
                    textDecoration: disabled ? 'line-through' : 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                  aria-pressed={v.size === selectedSize}
                >
                  {v.size}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {isOutOfStock ? (
            <span style={{ color: 'var(--danger)' }}>Out of stock</span>
          ) : isLowStock ? (
            <span style={{ color: 'var(--accent)' }}>Only {selectedVariant!.stock} left</span>
          ) : (
            <span style={{ color: 'var(--success)' }}>In stock</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)' }}>
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(selectedVariant?.stock ?? 20, q + 1))}
                style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              className="btn btn-outline"
              style={{ flex: 1 }}
              disabled={isOutOfStock || adding || buying}
              onClick={() => handleAddToCart(false)}
            >
              {adding ? 'Adding…' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>

          {!isOutOfStock && (
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={buying || adding}
              onClick={() => handleAddToCart(true)}
            >
              {buying ? 'Processing…' : 'Buy Now'}
            </button>
          )}
        </div>

        {selectedVariant && (
          <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>SKU: {selectedVariant.sku}</p>
        )}
      </div>
      {Toast}
    </div>
  );
}
