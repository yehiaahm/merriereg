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
          /* Wide enough that the ITEM column can hold a full product name
             beside its numbers, the way the receipt design lays it out — at
             the old 380px a name like "Mister Freedom Dude Rancher - Indigo
             Corduroy" wrapped to four cramped lines. */
          width: 480px;
          margin: 0 auto 60px;
          box-shadow: 0 4px 24px rgba(28, 23, 18, 0.18);
        }

        /* Print-only blank tail; on screen the panel's own bottom padding
           already ends the receipt, so the spacer would just add dead cream. */
        .receipt-feed { display: none; }

        /* The coarse thermal rendering of the logo; screen uses the fine one. */
        .receipt-logo-print { display: none; }

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
            /* Geometry for the ZKTeco ZKP8003: 576 dots per line at 203dpi
               is 72.08mm of printable width, centred on a 79.5mm roll, so
               3.71mm down each edge of the paper is dead.

               Where CSS x=0 lands in that picture is the whole question,
               and the first physical receipt answered it. That print used
               width 72mm at margin 0 4mm with 8px of panel padding, which
               puts the TOTAL column's right edge at CSS 73.9mm — and it
               came back reading "TOTA", one Arial character (~1.9mm) short.
               So the last printable column sits at CSS ~72mm, not at the
               ~75.8mm it would be if x=0 were the paper's edge: Chromium
               clamps a zero page margin up to the hardware margin, making
               CSS 0 the first printable dot and the band exactly 0 → 72mm.

               Everything therefore has to live inside CSS 0 → 72mm, and
               centring in that band is what centres it on the paper. 66mm
               at left:3mm leaves 3.0mm of slack inside the band on the left
               and 3.08mm on the right, which lands as 6.71mm / 6.79mm of
               margin on the physical paper — even to within a tenth of a
               millimetre, with room to absorb the roll's ±0.5mm width
               tolerance and any drift in its holder.

               (The previous 66mm at left:6mm satisfied the band by 0.08mm
               on the right — one drift away from clipping again — and read
               visibly lopsided at 9.71mm / 3.79mm on paper.)

               Note these are real physical widths, not a scaled screen
               size. An early version rendered the 380px screen layout and
               used CSS zoom to squeeze it into 80mm, which shrank 12px text
               to ~9.5px and added fractional-scaling blur — that was the
               tiny, faint print. Sizing in mm keeps every font-size at its
               true value. */
            left: 3mm;
            width: 66mm;
            margin: 0;
            box-shadow: none;
          }

          /* Data text (item names, prices, dates, totals) switches to a
             plain sans-serif for print: Space Mono is a screen display
             choice, and thin monospace glyphs at small sizes are exactly
             what a thermal head reproduces as broken/faint strokes.
             Brand elements (the MERRIER wordmark, the italic sign-off)
             set their own font-family inline and are untouched, so the
             branding still prints. */
          #pos-receipt { font-family: Arial, Helvetica, sans-serif !important; }

          /* A thermal head has one ink: black dots or nothing. Anything
             that isn't solid black — the red --accent brand colour, the
             #1c1712 near-black ink, any opacity below 1 — gets dithered
             into a gray halftone, which is why MERRIER and ESTD 2024 came
             out faded and blotchy on paper. Forcing pure black across the
             whole receipt makes every stroke a solid burn. */
          #pos-receipt, #pos-receipt * {
            color: #000 !important;
            opacity: 1 !important;
          }

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
            padding: 6px 2mm 0 !important;
          }

          /* Swap the fine halftone mark for the coarse solid-black one built
             for a 203dpi thermal head (see LogoMarkPrint). The screen version
             printed as the gray blob above MERRIER on the physical receipt:
             its dots are under 0.3mm and carry a fading opacity, and a head
             that can only burn a dot or not burn it turns both into noise.
             20mm keeps every dot in that mark comfortably above the head's
             minimum. */
          .receipt-logo-screen { display: none !important; }
          .receipt-logo-print {
            display: flex !important;
            justify-content: center;
            margin: 3px 0 4px !important;
          }
          .receipt-logo-print svg {
            width: 20mm;
            height: 20mm;
          }

          /* On screen the rules are a repeating-gradient background so the
             dashes can be long; backgrounds only print when the browser's
             "print backgrounds" option is on, so print swaps in a real
             border, which always prints. */
          .receipt-rule {
            background-image: none !important;
            height: 0 !important;
            border-top: 1.5px dashed #000 !important;
            /* Vertical space is paper, and paper is the thing being spent. */
            margin: 5px 0 !important;
          }
          .receipt-rule-short { width: 60% !important; margin: 5px auto !important; }

          /* Type sizes are set against what the head can actually resolve.
             At 203dpi a CSS pixel is 2.12 head dots, and an Arial stem is
             about 0.09em, so 11px text lands on a 2.1-dot stem — printable,
             but right at the edge where a stem starts breaking up. Nothing
             on the receipt goes below 12px (a 2.5-dot stem), and the small
             letter-spaced captions are bolded rather than shrunk. */
          .receipt-head { font-size: 13px !important; letter-spacing: 0.04em !important; }
          .receipt-brand {
            font-size: 38px !important;
            line-height: 1.05 !important;
            margin: 2px 0 3px !important;
          }
          .receipt-estd { font-size: 12px !important; margin-bottom: 10px !important; }
          .receipt-thanks { font-size: 12px !important; line-height: 1.5 !important; }
          .receipt-date { font-size: 12px !important; }
          .receipt-adjust { font-size: 12px !important; }

          /* At 66mm the ITEM column can't hold a product name beside the
             numbers — that's what wrapped names into five cramped lines and
             squeezed TOTAL off the edge of the paper. Print re-lays the
             header and each item as the same 4-track grid, then gives the
             name its own full-width row spanning all four tracks, so the
             numbers always sit in fixed columns underneath:

               Vintage Denim Bucket Hat - Olive S
                                  1    60 LE    60 LE

             Tracks are sized in mm so they hold their share of the 66mm band
             regardless of how the browser rounds px to mm. 7 + 16 + 17 plus
             three 1mm gaps is 43mm of the 62mm of content, sized so a
             five-figure price still clears its column at 12px. The 1fr track
             only ever holds the word ITEM — every item name spans all four
             tracks on its own row — so it can give up the difference. */
          .receipt-cols,
          .receipt-item {
            display: grid !important;
            grid-template-columns: 1fr 7mm 16mm 17mm;
            column-gap: 1mm;
            align-items: baseline !important;
          }
          /* The inline px column widths are for the wide screen preview; they
             would overflow their grid tracks if left in place. */
          .receipt-cols > span,
          .receipt-item > span { width: auto !important; padding-right: 0 !important; }
          /* Every cell is placed explicitly. Auto-placement would drop the
             numbers into columns 1-3 of the second row once the name has
             spanned the first, leaving them a full column left of the
             headers they belong under. */
          .receipt-item .c-desc { grid-column: 1 / -1; }
          .receipt-item .c-qty { grid-column: 2; }
          .receipt-item .c-price { grid-column: 3; }
          .receipt-item .c-total { grid-column: 4; }

          .receipt-cols {
            font-size: 12px !important;
            font-weight: 700 !important;
            letter-spacing: 0.02em !important;
          }
          .receipt-item { font-size: 12px !important; line-height: 1.4 !important; }
          .receipt-item .c-desc { font-size: 13px !important; }
          /* A price is a single token; wrapping it mid-number would be worse
             than letting a very long one run into the column beside it. */
          .c-qty, .c-price, .c-total { white-space: nowrap !important; }
          /* Drop the per-line currency suffix. "12999.50 LE" measures 18mm at
             this size against a 16mm PRICE column, so it would overflow left
             and collide with QTY; without the suffix the same columns hold
             eight digits and a decimal point. The grand TOTAL below still
             spells out LE. */
          .receipt-item .money-cur { display: none !important; }
          /* Keep a line item's name and its numbers on the same physical
             receipt rather than letting a page break fall between them. */
          .receipt-item { break-inside: avoid; page-break-inside: avoid; }

          /* The single most-read number on the receipt. */
          .receipt-total { font-size: 19px !important; }

          .receipt-pay { font-size: 12px !important; }

          /* The QR only has to survive a phone camera, and at 132px it was
             costing ~35mm of roll per sale. 26mm is 208 head dots across —
             ample for a 25x25 module code at roughly 8 dots a module. */
          .receipt-qr {
            margin: 2px 0 4px !important;
          }
          .receipt-qr img {
            width: 26mm !important;
            height: 26mm !important;
          }
          /* Was 9px: a 1.9-dot stem, the thinnest thing on the receipt and
             the first to break up. Bigger and bold rather than shrunk. */
          .receipt-qr-cap {
            font-size: 12px !important;
            font-weight: 700 !important;
          }

          /* Playfair is a high-contrast face — its thin strokes are about
             0.035em, so at 28px they came to 2.1 head dots and would print
             patchy where the wordmark above prints solid. The size is set
             from that thin stroke, not from how big the words look. */
          .receipt-signoff {
            font-size: 34px !important;
            margin: 6px 0 0 !important;
          }

          /* Trailing feed: the tear bar / auto-cutter sits downstream of the
             print head, so the last ~15-20mm of a receipt is whatever the
             printer happens to advance after the final line. Without this
             blank tail the cut lands mid-content — which is why the printed
             receipt ended at the QR code with the caption and sign-off
             missing entirely. */
          .receipt-feed {
            display: block !important;
            height: 20mm;
          }
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
