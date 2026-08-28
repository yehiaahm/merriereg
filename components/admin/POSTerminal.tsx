'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatEGP } from '@/lib/money';
import { POSReceipt } from './POSReceipt';

type Variant = {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  sku: string;
  price: number;
  stock: number;
};

type PosProduct = {
  id: string;
  name: string;
  image: string | null;
  variants: Variant[];
};

type CartLine = {
  variantId: string;
  productName: string;
  size: string;
  color: string;
  sku: string;
  price: number;
  stock: number;
  quantity: number;
};

type SaleResult = {
  orderNumber: string;
  total: number;
  subtotal: number;
  discount: number;
  paymentMethod: 'POS_CASH' | 'POS_CARD';
  customerName: string;
  createdAt: string;
  items: { productName: string; variantSize: string; variantColor: string; quantity: number; unitPrice: number; subtotal: number }[];
  orderId: string;
};

export function POSTerminal({ products }: { products: PosProduct[] }) {
  const [query, setQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountEGP, setDiscountEGP] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'POS_CASH' | 'POS_CARD'>('POS_CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q))
    );
  }, [products, query]);

  function addToCart(product: PosProduct, variant: Variant) {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      const currentQty = existing?.quantity ?? 0;
      if (currentQty + 1 > variant.stock) {
        setError(`Only ${variant.stock} in stock for ${product.name} (${variant.color}/${variant.size}).`);
        return prev;
      }
      if (existing) {
        return prev.map((l) => (l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(variantId: string, quantity: number) {
    setError(null);
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.variantId !== variantId) return l;
          if (quantity > l.stock) {
            setError(`Only ${l.stock} in stock for ${l.productName} (${l.color}/${l.size}).`);
            return l;
          }
          return { ...l, quantity };
        })
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const discountPiastres = Math.max(0, Math.round((Number(discountEGP) || 0) * 100));
  const clampedDiscount = Math.min(discountPiastres, subtotal);
  const total = subtotal - clampedDiscount;

  function resetForNewSale() {
    setCart([]);
    setDiscountEGP('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setPaymentMethod('POS_CASH');
    setError(null);
    setSaleResult(null);
  }

  async function completeSale() {
    if (cart.length === 0) {
      setError('Add at least one item to the sale.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          discountEGP: Number(discountEGP) || 0,
          customerName,
          customerPhone,
          customerEmail,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not complete the sale.');
        setSubmitting(false);
        return;
      }
      const order = data.order;
      setSaleResult({
        orderNumber: order.orderNumber,
        total: order.total,
        subtotal: order.subtotal,
        discount: order.discount,
        paymentMethod: order.paymentMethod,
        customerName: order.customerName,
        createdAt: order.createdAt,
        items: order.items,
        orderId: order.id,
      });
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (saleResult) {
    return <SaleCompleteScreen result={saleResult} onNewSale={resetForNewSale} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link href="/admin" style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
          &larr; Back to Admin
        </Link>
      </div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Point of Sale</h1>

      {error && (
        <div style={{ background: '#fdecea', border: '1px solid var(--danger)', padding: 12, fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32 }} className="admin-columns-grid">
        {/* Product search + grid */}
        <div>
          <input
            placeholder="Search products by name or SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', marginBottom: 16 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {filteredProducts.map((product) => {
              const expanded = expandedProductId === product.id;
              const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <div key={product.id} style={{ border: '1px solid var(--line)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setExpandedProductId(expanded ? null : product.id)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{product.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {totalStock === 0 ? 'Out of stock' : `${totalStock} in stock`}
                    </div>
                  </button>
                  {expanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={variant.stock === 0}
                          onClick={() => addToCart(product, variant)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 10px',
                            border: '1px solid var(--line)',
                            background: variant.stock === 0 ? 'var(--cream-2)' : '#fff',
                            cursor: variant.stock === 0 ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <span>
                            {variant.color} / {variant.size}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {formatEGP(variant.price)}
                            <span style={{ color: variant.stock === 0 ? 'var(--danger)' : 'var(--ink-soft)' }}>
                              ({variant.stock})
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <p style={{ color: 'var(--ink-soft)', gridColumn: '1 / -1' }}>No products match.</p>
            )}
          </div>
        </div>

        {/* Cart + checkout */}
        <div>
          <div style={{ border: '1px solid var(--line)', padding: 20, position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 16 }}>Cart</h2>

            {cart.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No items yet — click a product to add it.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map((line) => (
                  <div key={line.variantId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{line.productName}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
                        {line.color}/{line.size} &middot; {formatEGP(line.price)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)' }}>
                      <button type="button" onClick={() => updateQuantity(line.variantId, line.quantity - 1)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer' }}>
                        −
                      </button>
                      <span style={{ width: 24, textAlign: 'center' }}>{line.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(line.variantId, line.quantity + 1)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer' }}>
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.variantId)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="field">
              <label htmlFor="discount">Discount (EGP)</label>
              <input id="discount" type="number" min="0" step="0.01" value={discountEGP} onChange={(e) => setDiscountEGP(e.target.value)} placeholder="0" />
            </div>

            <details>
              <summary style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', color: 'var(--ink-soft)' }}>
                Customer information (optional)
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <div className="field">
                  <label htmlFor="pos-name">Name</label>
                  <input id="pos-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in Customer" />
                </div>
                <div className="field">
                  <label htmlFor="pos-phone">Phone</label>
                  <input id="pos-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="pos-email">Email</label>
                  <input id="pos-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </div>
              </div>
            </details>

            <div>
              <span className="eyebrow">Payment Method</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('POS_CASH')}
                  className={paymentMethod === 'POS_CASH' ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, padding: '10px 0' }}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('POS_CARD')}
                  className={paymentMethod === 'POS_CARD' ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, padding: '10px 0' }}
                >
                  Card
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Subtotal</span>
                <span>{formatEGP(subtotal)}</span>
              </div>
              {clampedDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Discount</span>
                  <span>-{formatEGP(clampedDiscount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18 }}>
                <span>Total</span>
                <span>{formatEGP(total)}</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting || cart.length === 0} onClick={completeSale}>
              {submitting ? 'Completing Sale…' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaleCompleteScreen({ result, onNewSale }: { result: SaleResult; onNewSale: () => void }) {
  return (
    <div>
      <style>{`
        #pos-receipt-wrap {
          width: 380px;
          margin: 0 auto 60px;
          box-shadow: 0 4px 24px rgba(28, 23, 18, 0.18);
        }

        @media print {
          /* 80mm thermal roll, no fixed page height so the receipt prints its
             own natural length instead of being laid out on an A4/Letter page. */
          @page { size: 80mm auto; margin: 0; }

          html, body { margin: 0; padding: 0; }

          /* The admin shell forces min-height: 100vh for the on-screen layout;
             left alone it still occupies that height while hidden below,
             which is what inflates the print output to a full-size blank page. */
          #admin-shell { min-height: 0 !important; }

          body * { visibility: hidden; }
          #pos-receipt-wrap, #pos-receipt-wrap * { visibility: visible; }

          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          #pos-receipt-wrap {
            position: absolute;
            top: 0;
            left: 0;
            /* A real physical width, not a scaled-down screen size — the
               previous version rendered the receipt at its 380px screen
               width (~100.6mm) and used CSS zoom to shrink everything,
               fonts included, to fit 80mm. That made already-small 12px
               text effectively ~9.5px and introduced fractional-scaling
               blur, which is why printed text came out tiny and faint.
               Sizing directly in mm keeps every font-size at its true,
               readable pixel value.

               The roll itself is 80mm, but most 80mm thermal printers
               can't actually mark all 80mm — their real printable head
               width is a few mm narrower. With margin:0 and content sized
               to the full 80mm, that unprintable strip ate into the right
               column (TOTAL/prices got sliced off, as seen on a physical
               receipt). Sizing content to 72mm and centering it on the
               80mm page leaves a safety margin on both edges so nothing
               printable falls outside the head's actual range. */
            width: 72mm;
            margin: 0 4mm;
            box-shadow: none;
          }

          /* Data text (item names, prices, dates, totals) switches to a
             plain sans-serif for print: Space Mono is a screen display
             choice, and thin monospace glyphs at small sizes are exactly
             what a thermal head reproduces as broken/faint strokes.
             Brand elements (the MERRIER wordmark, the Caveat signature)
             set their own font-family inline and are untouched, so the
             branding still prints. */
          #pos-receipt { font-family: Arial, Helvetica, sans-serif !important; }

          /* The red frame and cream panel are a screen "card" affordance —
             on a monochrome thermal printer that background usually won't
             render at all (Chrome/Edge don't print backgrounds by default),
             leaving their padding as pure dead space on both sides of the
             paper, which is the "too much unused space" in the printed
             photo. Print drops the frame/panel padding and background
             entirely and lets the dashed rules carry the layout instead. */
          .receipt-frame { background: none !important; padding: 0 !important; }
          .receipt-panel {
            background: none !important;
            background-image: none !important;
            /* The torn-edge cutout was clipping into the last lines of
               content (the "Thank You!" line was printing as "nk You!")
               whenever the print-time content height didn't exactly match
               the screen-preview height it was tuned for. */
            clip-path: none !important;
            padding: 10px 8px 16px !important;
          }

          /* Purely decorative screen flourish; a soft rgba gradient like
             this dithers into visible noise on a 1-bit thermal head. */
          .receipt-corner-smudge { display: none !important; }

          /* Section rules render at 50% opacity for a soft look on screen;
             a thermal head can't do partial ink, so a half-opacity black
             line prints as a broken, dotted-looking line instead of solid. */
          .receipt-rule { opacity: 1 !important; }
        }
      `}</style>

      <div style={{ maxWidth: 480, margin: '60px auto 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>&#10003;</div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Sale Completed</h1>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>Order #{result.orderNumber}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print Receipt
          </button>
          <button className="btn btn-outline" onClick={onNewSale}>
            New Sale
          </button>
          <Link href={`/admin/orders/${result.orderId}`} className="btn btn-outline">
            View Order
          </Link>
          <Link href="/admin" style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginTop: 8 }}>
            &larr; Back to Admin
          </Link>
        </div>
      </div>

      {/* Visible receipt preview — the same element is isolated for printing via the @media print rules above */}
      <div id="pos-receipt-wrap">
        <POSReceipt data={result} />
      </div>
    </div>
  );
}
