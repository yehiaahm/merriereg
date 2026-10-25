import { Fragment } from 'react';

const MESSAGES = ['New Drop', 'Winter Collection', 'Choose Your Merrier'];

// Repeated so one half of the track is wider than the screen; the track holds
// two identical halves so the marquee animation loops seamlessly.
const TRACK = Array.from({ length: 4 }, () => MESSAGES).flat();

function MarqueeContent() {
  return (
    <>
      {TRACK.map((msg, i) => (
        <Fragment key={i}>
          <i />
          {msg}
        </Fragment>
      ))}
    </>
  );
}

export function MarqueeStrip() {
  return (
    <div className="mr-marquee">
      <div className="mr-marquee-track">
        <span>
          <MarqueeContent />
        </span>
        <span aria-hidden="true">
          <MarqueeContent />
        </span>
      </div>
    </div>
  );
}
