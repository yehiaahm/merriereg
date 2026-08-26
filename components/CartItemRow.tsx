'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatEGP } from '@/lib/money';
import { useToast } from '@/components/AddToCartError';

type Item = {
  id: string;
  quantity: number;
  variant: {
    id: string;
    size: string;
    color: string;
    price: number;
    stock: number;
    product: { name: string; images: { url: string; altText: string | null }[] };
  };
};

export function CartItemRow({ item, freeCount = 0 }: { item: Item; freeCount?: number }) {
  const router = useRouter();
  const { show, Toast } = useToast();
  const [busy, setBusy] = useState(false);
  const image = item.variant.product.images[0];

  async function updateQuantity(nextQuantity: number) {
    if (nextQuantity < 1) return;
    setBusy(true);
    const res = await fetch('/api/cart', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, quantity: nextQuantity }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      show(data.error ?? 'Could not update quantity.', 'error');
      return;
    }
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch('/api/cart', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      show(data.error ?? 'Could not remove item.', 'error');
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 16, padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ position: 'relative', width: 90, height: 110, background: 'var(--cream-2)', flexShrink: 0 }}>
        {image && <Image src={image.url} alt={image.altText ?? ''} fill sizes="90px" style={{ objectFit: 'cover' }} />}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>{item.variant.product.name}</div>
          {freeCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'var(--accent)',
                color: 'var(--cream)',
                padding: '2px 6px',
              }}
            >
              {freeCount > 1 ? `${freeCount} FREE` : '1 FREE'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {item.variant.color} / {item.variant.size}
        </div>
        <div style={{ fontSize: 14 }}>{formatEGP(item.variant.price)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)' }}>
            <button
              disabled={busy}
              onClick={() => updateQuantity(item.quantity - 1)}
              style={{ width: 36, height: 36, background: 'none', border: 'none', cursor: 'pointer' }}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span style={{ width: 28, textAlign: 'center' }}>{item.quantity}</span>
            <button
              disabled={busy || item.quantity >= item.variant.stock}
              onClick={() => updateQuantity(item.quantity + 1)}
              style={{ width: 36, height: 36, background: 'none', border: 'none', cursor: 'pointer' }}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            disabled={busy}
            onClick={remove}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      </div>
      <div style={{ fontWeight: 700, textAlign: 'right' }}>
        {freeCount > 0 ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'line-through', fontWeight: 400 }}>
              {formatEGP(item.variant.price * item.quantity)}
            </div>
            <div>{formatEGP(item.variant.price * (item.quantity - freeCount))}</div>
          </>
        ) : (
          formatEGP(item.variant.price * item.quantity)
        )}
      </div>
      {Toast}
    </div>
  );
}
