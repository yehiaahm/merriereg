'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatEGP } from '@/lib/money';
import { useWishlistToggle } from '@/components/useWishlistToggle';
import { useToast } from '@/components/AddToCartError';
import { flyToCart } from '@/lib/fly-to-cart';

type CardVariant = {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  active: boolean;
};

type CardProduct = {
  id?: string;
  slug: string;
  name: string;
  category?: { name: string } | null;
  images: { url: string; altText: string | null; colorValue: string | null }[];
  variants: CardVariant[];
};

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL'];
const MAX_SWATCHES = 5;

function sizeRank(size: string) {
  const i = SIZE_ORDER.indexOf(size.toUpperCase());
  if (i >= 0) return i;
  const n = parseFloat(size);
  return Number.isNaN(n) ? 100 : 100 + n;
}

export function ProductCard({
  product,
  isWishlisted = false,
  priority = false,
}: {
  product: CardProduct;
  isWishlisted?: boolean;
  // Above-the-fold cards load eagerly; everything else is lazy-loaded.
  priority?: boolean;
}) {
  const router = useRouter();
  const { show, Toast } = useToast();
  const { wishlisted, busy, toggle, Toast: WishlistToast } = useWishlistToggle(product.id!, isWishlisted);

  const variants = useMemo(
    () => product.variants.filter((v) => v.active).sort((a, b) => sizeRank(a.size) - sizeRank(b.size)),
    [product.variants]
  );

  const colors = useMemo(() => {
    const seen = new Map<string, { name: string; hex: string | null; inStock: boolean }>();
    for (const v of variants) {
      const entry = seen.get(v.color) ?? { name: v.color, hex: v.colorHex, inStock: false };
      if (v.stock > 0) entry.inStock = true;
      seen.set(v.color, entry);
    }
    return Array.from(seen.values());
  }, [variants]);

  const [color, setColor] = useState(() => (colors.find((c) => c.inStock) ?? colors[0])?.name ?? '');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  const sizes = variants.filter((v) => v.color === color);
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const soldOut = totalStock === 0;

  // Price: the cheapest active variant leads; a strike-through only when that variant is really discounted.
  const lead = variants.reduce<CardVariant | null>((best, v) => (!best || v.price < best.price ? v : best), null);
  const maxPrice = variants.reduce((m, v) => Math.max(m, v.price), 0);
  const onSale = !!lead && !!lead.compareAtPrice && lead.compareAtPrice > lead.price;
  const hasRange = !!lead && maxPrice > lead.price;

  // Images follow the chosen swatch when the product tags its photos by color.
  const gallery = useMemo(() => {
    const tagged = product.images.filter((img) => img.colorValue === color);
    return tagged.length > 0 ? tagged : product.images;
  }, [product.images, color]);
  const primary = gallery[0];
  const secondary = gallery[1];

  async function add(variant: CardVariant) {
    if (pending || variant.stock <= 0) return;
    setPending(variant.id);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variant.id, quantity: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        show(data.error ?? 'Could not add to cart.', 'error');
        return;
      }
      show(`Added ${product.name} (${variant.color} / ${variant.size}) to cart.`);
      setJustAdded(variant.id);
      // The cart counts refresh as the product lands in the cart icon.
      flyToCart(mediaRef.current).then(() => router.refresh());
      setTimeout(() => {
        setJustAdded(null);
        setOpen(false);
      }, 1400);
    } catch {
      show('Network error — please try again.', 'error');
    } finally {
      setPending(null);
    }
  }

  const href = `/product/${product.slug}`;

  return (
    <>
      <article
        className={`mr-pcard${soldOut ? ' mr-pcard--soldout' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <div className="mr-pcard-media" ref={mediaRef}>
          <Link href={href} className="mr-pcard-imglink" tabIndex={-1} aria-hidden="true">
            {primary ? (
              <>
                <Image
                  key={primary.url}
                  src={primary.url}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 50vw, (max-width: 1100px) 33vw, 25vw"
                  priority={priority}
                  className="mr-pcard-img"
                />
                {secondary && (
                  <Image
                    key={secondary.url}
                    src={secondary.url}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 50vw, (max-width: 1100px) 33vw, 25vw"
                    className="mr-pcard-img mr-pcard-img--alt"
                  />
                )}
              </>
            ) : (
              <span className="mr-pcard-placeholder">MERRIER</span>
            )}
          </Link>

          {(onSale || soldOut) && (
            <div className="mr-pcard-tags">
              {onSale && !soldOut && <span className="mr-tag mr-tag--sale">Sale</span>}
              {soldOut && <span className="mr-tag">Sold out</span>}
            </div>
          )}

          <button
            type="button"
            className="mr-pcard-heart"
            onClick={toggle}
            disabled={busy}
            aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            aria-pressed={wishlisted}
            data-active={wishlisted}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 20.4S3.5 15.1 3.5 9.1A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.5c0 6-8.5 11.3-8.5 11.3Z"
                fill={wishlisted ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {!soldOut && sizes.length > 0 && (
            <>
              <button
                type="button"
                className="mr-qa-toggle"
                onClick={() => setOpen(true)}
                aria-expanded={open}
                aria-label={`Quick add ${product.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>

              <div className="mr-qa" data-open={open} role="group" aria-label={`Quick add ${product.name}`}>
                <div className="mr-qa-head">
                  <span>Quick add{colors.length > 1 ? ` · ${color}` : ''}</span>
                  <button type="button" className="mr-qa-close" onClick={() => setOpen(false)} aria-label="Close quick add">
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="mr-qa-sizes">
                  {sizes.map((v) => {
                    const out = v.stock <= 0;
                    const done = justAdded === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className="mr-qa-size"
                        data-done={done}
                        disabled={out || pending !== null}
                        onClick={() => add(v)}
                        aria-label={
                          out
                            ? `Size ${v.size}, sold out`
                            : `Add size ${v.size} to cart${v.stock <= 3 ? `, only ${v.stock} left` : ''}`
                        }
                        title={out ? 'Sold out' : v.stock <= 3 ? `Only ${v.stock} left` : undefined}
                      >
                        {pending === v.id ? '…' : done ? '✓' : v.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mr-pcard-info">
          {product.category?.name && <span className="mr-pcard-cat">{product.category.name}</span>}
          <Link href={href} className="mr-pcard-name">
            {product.name}
            {soldOut && <span className="mr-sr"> — sold out</span>}
          </Link>
          <div className="mr-pcard-row">
            <span className="mr-pcard-price">
              {lead ? (
                <>
                  <span className={onSale ? 'mr-pcard-now mr-pcard-now--sale' : 'mr-pcard-now'}>
                    {hasRange && <span className="mr-pcard-from">From </span>}
                    {formatEGP(lead.price)}
                  </span>
                  {onSale && <s className="mr-pcard-was">{formatEGP(lead.compareAtPrice!)}</s>}
                </>
              ) : (
                <span className="mr-pcard-now">&mdash;</span>
              )}
            </span>
            {colors.length > 1 && (
              <span className="mr-swatches" role="group" aria-label="Colors">
                {colors.slice(0, MAX_SWATCHES).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="mr-swatch"
                    style={{ background: c.hex ?? 'var(--cream-2)' }}
                    aria-label={`${c.name}${c.inStock ? '' : ' (sold out)'}`}
                    aria-pressed={c.name === color}
                    data-out={!c.inStock}
                    title={c.name}
                    onClick={() => setColor(c.name)}
                  />
                ))}
                {colors.length > MAX_SWATCHES && <span className="mr-swatch-more">+{colors.length - MAX_SWATCHES}</span>}
              </span>
            )}
          </div>
        </div>
      </article>
      {Toast}
      {WishlistToast}
    </>
  );
}
