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

function formatAmount(piastres: number): string {
  const egp = piastres / 100;
  return egp % 1 === 0 ? egp.toFixed(0) : egp.toFixed(2);
}

function formatLE(piastres: number): string {
  return `${formatAmount(piastres)} LE`;
}

// A price for the PRICE / TOTAL columns, with the currency in its own span.
// Those two columns are 16mm and 17mm on paper, and "12999.50 LE" needs 18mm
// at the print size — it would overflow leftward into the QTY column and
// collide with it. Print hides the suffix (see the .money-cur print rule),
// which buys back 5mm and leaves the columns able to hold eight digits and a
// decimal point. The grand TOTAL line still spells out LE, so the currency is
// stated on every receipt; per-line suffixes are redundant next to it.
function Money({ piastres }: { piastres: number }) {
  return (
    <>
      {formatAmount(piastres)}
      <span className="money-cur"> LE</span>
    </>
  );
}

function itemLabel(item: ReceiptItem): string {
  const variant = [item.variantColor, item.variantSize].filter(Boolean).join(' ');
  return variant ? `${item.productName} - ${variant}` : item.productName;
}

// Dense halftone spiral: concentric rings of dots that shrink, spread out and
// fade toward the rim, with each ring rotated slightly against the last so the
// overlap reads as a swirl. Screen only — at this density the dots are far
// under a thermal head's resolution, so print swaps in LogoMarkPrint below.
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

// The same sunburst, redrawn to the tolerances of an 80mm thermal head. That
// head is a row of ~203dpi elements that are either on or off: it can't hold a
// dot smaller than about 0.3mm, can't render a partial-opacity dot as anything
// but noise, and can't keep a gap narrower than a few head dots from closing
// up. LogoMark's screen version breaks all three at once — sub-0.3mm dots at
// fading opacity, packed tight — which is why it came off the printer as the
// gray blob above MERRIER.
//
// So this variant: no opacity ramp (every dot solid black), far fewer rings,
// and dots sized and spaced in units that survive the conversion. Rendered at
// 20mm (see the .receipt-logo-print rule), one viewBox unit is 1/6 mm, so the
// dots below are 0.58-0.83mm across with ~0.5mm of clear paper between them —
// roughly 4-7 head dots of ink against 4 of gap. It reads as a coarser mark
// than the screen one; a fine halftone simply isn't a thing this printer can
// reproduce.
function LogoMarkPrint() {
  const center = 60;
  const rings = 6;
  const dots: { cx: number; cy: number; r: number }[] = [];

  for (let ring = 0; ring < rings; ring++) {
    const radius = 15 + ring * 7.6;
    const dotRadius = 2.5 - ring * 0.15;
    const count = Math.max(6, Math.round((2 * Math.PI * radius) / 8));
    // Same trick as the screen mark: rotate each ring against the last so the
    // rings read as radiating arms rather than flat concentric circles.
    const offset = ring * 0.42;

    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      dots.push({
        cx: Math.round((center + Math.cos(angle) * radius) * 100) / 100,
        cy: Math.round((center + Math.sin(angle) * radius) * 100) / 100,
        r: Math.round(dotRadius * 100) / 100,
      });
    }
  }

  return (
    <svg viewBox="0 0 120 120" role="presentation">
      <circle cx={center} cy={center} r="7.5" fill="#000" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#000" />
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
// The filter is referenced as url(#n), not url(%23n): encodeURIComponent below does the
// escaping. Pre-escaping it yields %2523, which no longer resolves to the filter — and an
// unresolved filter reference doesn't drop the <rect>, it paints it in the default solid
// black, covering the whole panel and swallowing every line of ink-coloured text on it.
const PAPER_GRAIN =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
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

          {/* Two renderings of one mark: the fine halftone for screen, a
              coarser solid-black one for the thermal head. Each hides the
              other (see the .receipt-logo-* rules). */}
          <div
            className="receipt-logo-screen"
            style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 6px' }}
          >
            <LogoMark />
          </div>
          <div className="receipt-logo-print" aria-hidden>
            <LogoMarkPrint />
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
                  <Money piastres={item.unitPrice} />
                </span>
                <span className="c-total" style={{ width: COL_TOTAL, textAlign: 'right' }}>
                  <Money piastres={item.subtotal} />
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
