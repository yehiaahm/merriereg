import { Fragment } from 'react';

const PROMO_MESSAGES = [
  'Follow Us & Get 10% Off (Code: FOLLOW10)',
  'Get 10% Off Your Order (Code: Pasmala.1)',
];

// Repeated so the marquee track is long enough to loop seamlessly
// (4 × 2 messages = 8 items per track).
const TRACK_MESSAGES = Array.from({ length: 4 }, () => PROMO_MESSAGES).flat();

function PromoTrackContent() {
  return (
    <>
      {TRACK_MESSAGES.map((msg, i) => (
        <Fragment key={i}>
          <i />
          {msg}
        </Fragment>
      ))}
    </>
  );
}

export function PromoBar() {
  return (
    <div className="mr-promo-bar" id="mrTop">
      <div className="mr-promo-track">
        <span>
          <PromoTrackContent />
        </span>
        <span aria-hidden="true">
          <PromoTrackContent />
        </span>
      </div>
    </div>
  );
}
