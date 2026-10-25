import { Fragment } from 'react';

const PROMO_MESSAGES = ['Follow Us & Get 10% Off (Code: FOLLOW10)'];

// Repeated so the marquee track is long enough to loop seamlessly with a single
// message (it was 4 messages × 2 before the bundle offers were removed).
const TRACK_MESSAGES = Array.from({ length: 8 }, () => PROMO_MESSAGES[0]);

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
