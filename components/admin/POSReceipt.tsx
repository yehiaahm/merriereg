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

function formatLE(piastres: number): string {
  const egp = piastres / 100;
  const formatted = egp % 1 === 0 ? egp.toFixed(0) : egp.toFixed(2);
  return `${formatted} LE`;
}

// Concentric rings of dots, shrinking in size toward the edge, approximating the
// halftone-circle logo mark from the reference receipt design.
function LogoDots() {
  const rings = 9;
  const center = 60;
  const dots: { cx: number; cy: number; r: number; opacity: number }[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const radius = (ring / (rings - 1)) * 52;
    const dotCount = Math.max(6, Math.round(radius * 0.9));
    const dotRadius = Math.max(0.6, 2.4 - ring * 0.22);
    const opacity = ring === 0 ? 1 : Math.max(0.15, 1 - ring * 0.1);
    if (radius === 0) {
      dots.push({ cx: center, cy: center, r: dotRadius, opacity });
      continue;
    }
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2;
      dots.push({
        cx: Math.round((center + Math.cos(angle) * radius) * 100) / 100,
        cy: Math.round((center + Math.sin(angle) * radius) * 100) / 100,
        r: dotRadius,
        opacity,
      });
    }
  }
  return (
    <svg viewBox="0 0 120 120" width="90" height="90" role="presentation">
      <circle cx={center} cy={center} r="18" fill="var(--accent)" />
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill="var(--accent)"
          opacity={d.opacity}
        />
      ))}
    </svg>
  );
}

function DashedRule() {
  return (
    <div
      className="receipt-rule"
      style={{
        borderTop: '1.5px dashed var(--ink)',
        opacity: 0.5,
        margin: '10px 0',
      }}
    />
  );
}

// Jagged bottom edge mimicking a torn sheet of receipt paper, like the reference design.
function tornBottomClipPath(teeth = 28, toothDepth = 7): string {
  const points = ['0% 0%', '100% 0%'];
  for (let i = teeth; i >= 0; i--) {
    const x = ((i / teeth) * 100).toFixed(2);
    const y = i % 2 === 0 ? '100%' : `calc(100% - ${toothDepth}px)`;
    points.push(`${x}% ${y}`);
  }
  return `polygon(${points.join(', ')})`;
}

// Faint fractal-noise texture so the cream panel reads as paper rather than a flat fill.
const PAPER_GRAIN =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  ) +
  '")';

// Soft, layered smudge in the bottom-left corner echoing the ink thumbprint mark in the reference receipt.
function CornerSmudge() {
  return (
    <div
      aria-hidden
      className="receipt-corner-smudge"
      style={{
        position: 'absolute',
        left: -20,
        bottom: -10,
        width: 170,
        height: 130,
        pointerEvents: 'none',
        opacity: 0.5,
        background:
          'radial-gradient(ellipse 60px 40px at 35% 60%, rgba(28,23,18,0.16), transparent 70%),' +
          'radial-gradient(ellipse 45px 30px at 55% 40%, rgba(28,23,18,0.12), transparent 70%),' +
          'radial-gradient(ellipse 70px 50px at 30% 75%, rgba(28,23,18,0.08), transparent 70%)',
      }}
    />
  );
}

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
        href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Caveat:wght@600;700&display=swap"
      />

      {/* Outer red frame — decorative on screen only; print strips its
          padding/background entirely (see receipt-frame print rules) so it
          doesn't eat into the 80mm paper width. */}
      <div className="receipt-frame" style={{ background: 'var(--accent)', padding: 24 }}>
        {/* Cream paper panel, clipped to a torn bottom edge on screen. Print
            drops the background, texture and torn-edge clip (see
            receipt-panel print rules) — the clip-path was cutting into the
            bottom content once the panel's real print height differed from
            its screen-preview height. */}
        <div
          className="receipt-panel"
          style={{
            position: 'relative',
            background: 'var(--cream)',
            backgroundImage: PAPER_GRAIN,
            padding: '28px 26px 40px',
            clipPath: tornBottomClipPath(),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <span>RECEIPT</span>
            <span style={{ fontSize: 13 }}>No. {data.orderNumber}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '18px 0 8px',
            }}
          >
            <LogoDots />
          </div>

          <h1
            style={{
              fontFamily: 'var(--display)',
              color: 'var(--accent)',
              textAlign: 'center',
              fontSize: 44,
              letterSpacing: '0.03em',
              margin: '0 0 2px',
            }}
          >
            MERRIER
          </h1>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--accent)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              fontSize: 12,
              margin: '0 0 16px',
            }}
          >
            ESTD 2024
          </p>

          <p
            style={{
              textAlign: 'center',
              fontSize: 12,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Thank you for choosing Merrier.
            <br />
            We appreciate your support.
          </p>

          <DashedRule />
          <p style={{ textAlign: 'center', fontSize: 12, margin: 0 }}>
            DATE: {dateLabel} &nbsp; {timeLabel}
          </p>
          <DashedRule />

          <div
            style={{
              display: 'flex',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ flex: 1 }}>ITEM</span>
            <span style={{ width: 32, textAlign: 'right' }}>QTY</span>
            <span style={{ width: 60, textAlign: 'right' }}>PRICE</span>
            <span style={{ width: 64, textAlign: 'right' }}>TOTAL</span>
          </div>
          <DashedRule />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.items.map((item, i) => (
              <div
                key={i}
                style={{ display: 'flex', fontSize: 12, lineHeight: 1.4 }}
              >
                <span style={{ flex: 1, paddingRight: 8 }}>
                  {item.productName}
                  {item.variantColor || item.variantSize
                    ? ` - ${item.variantColor} ${item.variantSize}`.trim()
                    : ''}
                </span>
                <span style={{ width: 32, textAlign: 'right' }}>
                  {item.quantity}
                </span>
                <span style={{ width: 60, textAlign: 'right' }}>
                  {formatLE(item.unitPrice)}
                </span>
                <span style={{ width: 64, textAlign: 'right' }}>
                  {formatLE(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {data.discount > 0 && (
            <>
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}
              >
                <span>SUBTOTAL:</span>
                <span>{formatLE(data.subtotal)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}
              >
                <span>DISCOUNT:</span>
                <span>-{formatLE(data.discount)}</span>
              </div>
            </>
          )}

          <DashedRule />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            <span>TOTAL:</span>
            <span>{formatLE(data.total)}</span>
          </div>
          <DashedRule />

          <p style={{ textAlign: 'center', fontSize: 12, margin: 0 }}>
            PAYMENT METHOD:{' '}
            {data.paymentMethod === 'POS_CASH' ? 'CASH' : 'CARD'}
          </p>
          <DashedRule />

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '4px 0 6px',
            }}
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
              width={130}
              height={130}
            />
          </div>
          <p
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--accent)',
              margin: '0 0 14px',
            }}
          >
            SCAN TO VISIT OUR WEBSITE
          </p>

          <p
            style={{
              textAlign: 'center',
              fontFamily: "'Caveat', cursive",
              color: 'var(--accent)',
              fontSize: 34,
              margin: '0 0 4px',
            }}
          >
            Thank You!
          </p>

          <CornerSmudge />
        </div>
      </div>
    </div>
  );
}
