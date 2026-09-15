import { Fragment } from 'react';

const PROMO_MESSAGES = [
  '3 T-Shirts for 950 LE',
  '3 Shorts for 700 LE',
  '3 Pants for 1,500 LE',
  'Follow Us & Get 10% Off (Code: FOLLOW10)',
];

// Repeated twice so the marquee loops seamlessly, matching the original markup.
const TRACK_MESSAGES = [...PROMO_MESSAGES, ...PROMO_MESSAGES];

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
