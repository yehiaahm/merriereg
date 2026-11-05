import { Fragment } from 'react';
import { listPromoBarMessages } from '@/lib/discount-codes';

// Minimum items per scrolling track so the marquee loops seamlessly even when
// the admin has only one or two codes switched on.
const MIN_TRACK_ITEMS = 8;

function PromoTrackContent({ messages }: { messages: string[] }) {
  const repeats = Math.max(1, Math.ceil(MIN_TRACK_ITEMS / messages.length));
  const track = Array.from({ length: repeats }, () => messages).flat();
  return (
    <>
      {track.map((msg, i) => (
        <Fragment key={i}>
          <i />
          {msg}
        </Fragment>
      ))}
    </>
  );
}

/** Top scrolling bar. Messages come from the discount codes the admin flagged "show in promo bar". */
export async function PromoBar() {
  const messages = await listPromoBarMessages();
  if (messages.length === 0) return null;

  return (
    <div className="mr-promo-bar" id="mrTop">
      <div className="mr-promo-track">
        <span>
          <PromoTrackContent messages={messages} />
        </span>
        <span aria-hidden="true">
          <PromoTrackContent messages={messages} />
        </span>
      </div>
    </div>
  );
}
