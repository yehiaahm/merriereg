'use client';

type ReceiptItem = {
  productName: string;
  variantSize: string;
  variantColor: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type ReceiptData = {
  orderNumber: string;
  total: number;
  subtotal: number;
  discount: number;
  paymentMethod: 'POS_CASH' | 'POS_CARD';
  customerName: string;
  createdAt: string;
  items: ReceiptItem[];
};

// Column widths for the ITEM / QTY / PRICE / TOTAL table. Shared between the
// header row and every line item so the columns line up exactly.
const COL_QTY = 36;
const COL_PRICE = 60;
const COL_TOTAL = 66;

function formatLE(piastres: number): string {
  const egp = piastres / 100;
  const formatted = egp % 1 === 0 ? egp.toFixed(0) : egp.toFixed(2);
  return `${formatted} LE`;
}

function itemLabel(item: ReceiptItem): string {
  const variant = [item.variantColor, item.variantSize].filter(Boolean).join(' ');
  return variant ? `${item.productName} - ${variant}` : item.productName;
}

// Dense halftone spiral: concentric rings of dots that shrink, spread out and
// fade toward the rim, with each ring rotated slightly against the last so the
// overlap reads as a swirl. Screen only — a halftone dot field is precisely
// what a 1-bit thermal head renders as a gray smudge, so print hides it (see
// the .receipt-logo print rule).
function LogoMark({ size = 84 }: { size?: number }) {
  const rings = 26;
  const center = 60;
  const maxRadius = 56;
  const dots: { cx: number; cy: number; r: number; opacity: number }[] = [];

  for (let ring = 1; ring <= rings; ring++) {
    const t = ring / rings;
    const radius = Math.pow(t, 0.92) * maxRadius;
    const dotRadius = 1.9 - t * 1.35;
    const spacing = 3 + t * 2.7;
    const count = Math.max(6, Math.round((2 * Math.PI * radius) / spacing));
    // Rotating each ring by a constant increment is what produces the spiral
    // arms; an un-rotated stack of rings reads as flat concentric circles.
    const offset = ring * 0.55;
    const opacity = t < 0.55 ? 1 : Math.max(0.22, 1 - (t - 0.55) * 1.75);

    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      dots.push({
        cx: Math.round((center + Math.cos(angle) * radius) * 100) / 100,
        cy: Math.round((center + Math.sin(angle) * radius) * 100) / 100,
        r: Math.round(dotRadius * 100) / 100,
        opacity: Math.round(opacity * 100) / 100,
      });
    }
  }

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="presentation">
      <circle cx={center} cy={center} r="9" fill="var(--accent)" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="var(--accent)" opacity={d.opacity} />
      ))}
    </svg>
  );
}

// Long-dash separator. Drawn as a repeating gradient rather than a CSS dashed
// border because `border-style: dashed` locks the dash length to the border
// width, which can't reach the long dashes the receipt design uses. Print swaps
// it back to a real border (see the .receipt-rule print rule) — a background
// image depends on the browser's "print backgrounds" setting, a border doesn't.
function DashedRule({ short = false }: { short?: boolean }) {
  return (
    <div
      className={short ? 'receipt-rule receipt-rule-short' : 'receipt-rule'}
      style={{
        height: 2,
        margin: short ? '10px auto 0' : '14px 0',
        width: short ? '62%' : undefined,
        backgroundImage:
          'repeating-linear-gradient(to right, var(--ink) 0 9px, transparent 9px 17px)',
      }}
    />
  );
}

// Faint fractal-noise texture so the cream panel reads as paper rather than a flat fill.
const PAPER_GRAIN =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  ) +
  '")';

export function POSReceipt({ data }: { data: ReceiptData }) {
  const date = new Date(data.createdAt);
  const dateLabel = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      id="pos-receipt"
      style={{
        fontFamily: "'Space Mono', 'Courier New', monospace",
        color: 'var(--ink)',
      }}
    >
      {/* Loaded here (rather than the root layout) so the fonts are only fetched when a receipt actually renders. React 19 hoists <link> tags to <head> wherever they appear. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- this rule targets the Pages Router; see app/layout.tsx for the same pattern */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Roboto+Slab:wght@600;700&family=Playfair+Display:ital,wght@1,700&display=swap"
      />

      {/* Outer red frame — decorative on screen only; print strips its
          padding/background entirely (see receipt-frame print rules) so it
          doesn't eat into the 80mm paper width. */}
      <div className="receipt-frame" style={{ background: 'var(--accent)', padding: 26 }}>
        {/* Cream paper panel. Print drops the background and texture (see the
            receipt-panel print rules) — thermal paper supplies its own. */}
        <div
          className="receipt-panel"
          style={{
            background: 'var(--cream)',
            backgroundImage: PAPER_GRAIN,
            padding: '26px 26px 22px',
          }}
        >
          <div
            className="receipt-head"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 10,
              fontSize: 17,
              letterSpacing: '0.08em',
            }}
          >
            <span style={{ color: 'var(--accent)' }}>RECEIPT</span>
            <span style={{ whiteSpace: 'nowrap' }}>No. {data.orderNumber}</span>
          </div>

          <div
            className="receipt-logo"
            style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 6px' }}
          >
            <LogoMark />
          </div>

          <h1
            className="receipt-brand"
            style={{
              fontFamily: "'Roboto Slab', 'Zilla Slab', Georgia, serif",
              fontWeight: 700,
              color: 'var(--accent)',
              textAlign: 'center',
              fontSize: 48,
              lineHeight: 1.05,
              letterSpacing: '0.01em',
              margin: '0 0 6px',
            }}
          >
            MERRIER
          </h1>
          <p
            className="receipt-estd"
            style={{
              textAlign: 'center',
              color: 'var(--accent)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontSize: 14,
              margin: '0 0 18px',
            }}
          >
            ESTD 2024
          </p>

          <p
            className="receipt-thanks"
            style={{ textAlign: 'center', fontSize: 13, lineHeight: 1.7, margin: 0 }}
          >
            Thank you for choosing Merrier.
            <br />
            We appreciate your support.
          </p>

          <DashedRule />
          <p className="receipt-date" style={{ textAlign: 'center', fontSize: 13, margin: 0 }}>
            DATE: {dateLabel} &nbsp; {timeLabel}
          </p>
          <DashedRule />

          {/* Header and every line item share the same column widths. Print
              re-lays both as a grid so the item name gets a full-width row of
              its own — at 66mm the ITEM column is far too narrow to hold a
              product name beside the numbers (see the .receipt-item print
              rules). */}
          <div
            className="receipt-cols"
            style={{ display: 'flex', alignItems: 'baseline', fontSize: 12, letterSpacing: '0.05em' }}
          >
            <span className="c-desc" style={{ flex: 1, minWidth: 0 }}>
              ITEM
            </span>
            <span className="c-qty" style={{ width: COL_QTY, textAlign: 'right' }}>
              QTY
            </span>
            <span className="c-price" style={{ width: COL_PRICE, textAlign: 'right' }}>
              PRICE
            </span>
            <span className="c-total" style={{ width: COL_TOTAL, textAlign: 'right' }}>
              TOTAL
            </span>
          </div>
          <DashedRule />

          {data.items.map((item, i) => (
            <div key={i}>
              <div
                className="receipt-item"
                style={{ display: 'flex', alignItems: 'center', fontSize: 12, lineHeight: 1.6 }}
              >
                <span
                  className="c-desc"
                  style={{ flex: 1, minWidth: 0, paddingRight: 10, overflowWrap: 'anywhere' }}
                >
                  {itemLabel(item)}
                </span>
                <span className="c-qty" style={{ width: COL_QTY, textAlign: 'right' }}>
                  {item.quantity}
                </span>
                <span className="c-price" style={{ width: COL_PRICE, textAlign: 'right' }}>
                  {formatLE(item.unitPrice)}
                </span>
                <span className="c-total" style={{ width: COL_TOTAL, textAlign: 'right' }}>
                  {formatLE(item.subtotal)}
                </span>
              </div>
              <DashedRule />
            </div>
          ))}

          {data.discount > 0 && (
            <>
              <div
                className="receipt-adjust"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}
              >
                <span>SUBTOTAL:</span>
                <span>{formatLE(data.subtotal)}</span>
              </div>
              <div
                className="receipt-adjust"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}
              >
                <span>DISCOUNT:</span>
                <span>-{formatLE(data.discount)}</span>
              </div>
              <DashedRule />
            </>
          )}

          <div
            className="receipt-total"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 10,
              fontWeight: 700,
              fontSize: 24,
            }}
          >
            <span>TOTAL:</span>
            <span style={{ whiteSpace: 'nowrap' }}>{formatLE(data.total)}</span>
          </div>
          <DashedRule />

          <p className="receipt-pay" style={{ textAlign: 'center', fontSize: 11, margin: 0 }}>
            PAYMENT METHOD: {data.paymentMethod === 'POS_CASH' ? 'CASH' : 'CARD'}
          </p>
          <DashedRule />

          <div
            className="receipt-qr"
            style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 8px' }}
          >
            {/* Static file (not generated from NEXT_PUBLIC_SITE_URL) — that
                env var is inlined into the JS bundle at build time, so if
                it's ever missing/wrong in the Railway build step the QR
                would silently keep encoding a stale/wrong URL forever
                regardless of the runtime environment. A fixed, known-good
                image sidesteps that entirely. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- plain static asset, doesn't need next/image's optimization pipeline */}
            <img
              src="/receipt/qr-code.png"
              alt="QR code linking to the Merrier website"
              width={132}
              height={132}
            />
          </div>
          <p
            className="receipt-qr-cap"
            style={{
              textAlign: 'center',
              fontSize: 10,
              letterSpacing: '0.08em',
              color: 'var(--accent)',
              margin: 0,
            }}
          >
            SCAN TO VISIT OUR WEBSITE
          </p>
          <DashedRule short />

          <p
            className="receipt-signoff"
            style={{
              textAlign: 'center',
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: 'italic',
              fontWeight: 700,
              color: 'var(--accent)',
              fontSize: 36,
              lineHeight: 1.2,
              margin: '10px 0 0',
            }}
          >
            Thank You!
          </p>

          {/* Blank tail, print-only. The tear bar / auto-cutter sits a couple
              of centimetres downstream of the print head, so without trailing
              feed the cut lands mid-content — which is why the QR caption and
              sign-off were missing from printed receipts entirely. */}
          <div className="receipt-feed" aria-hidden />
        </div>
      </div>
    </div>
  );
}
