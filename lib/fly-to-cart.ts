// Add-to-cart "flying product" animation. Call after the cart API reports success, never before.
// Built on the Web Animations API (the project has no animation library). Browser-only.

const CART_TARGET = '[data-cart-target]';
const DURATION_MS = 760;
const BUMP_MS = 600;
const MAX_FLIGHTS = 4;
const END_SIZE = 26;
const STEPS = 28;

let activeFlights = 0;
let bumpTimer: ReturnType<typeof setTimeout> | undefined;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The cart icon that is actually on screen for this layout (desktop link or mobile icon). */
function visibleCartTarget(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(CART_TARGET)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

/** Pulses the cart icon and its count badge. Under reduced motion CSS swaps the pulse for a colour flash. */
export function bumpCart() {
  const target = visibleCartTarget();
  if (!target) return;
  target.classList.remove('mr-cart-bump');
  void target.offsetWidth; // restart the animation on rapid adds
  target.classList.add('mr-cart-bump');
  clearTimeout(bumpTimer);
  bumpTimer = setTimeout(() => target.classList.remove('mr-cart-bump'), BUMP_MS);
}

/**
 * Flies a copy of the product image from `source` (an image or the frame that holds it) into the
 * visible cart icon, then bumps the cart. Resolves when the product has arrived (or immediately when
 * there is nothing to animate) so callers can refresh cart state at that moment. Never rejects.
 */
export function flyToCart(source: HTMLElement | null): Promise<void> {
  return new Promise((resolve) => {
    try {
      const target = visibleCartTarget();
      const img = source instanceof HTMLImageElement ? source : source?.querySelector('img');
      const src = img?.currentSrc || img?.src;
      if (!source || !target || !img || !src || typeof source.getBoundingClientRect !== 'function') {
        bumpCart();
        return resolve();
      }
      if (reducedMotion() || activeFlights >= MAX_FLIGHTS || typeof Element.prototype.animate !== 'function') {
        bumpCart();
        return resolve();
      }

      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      // Skip when the product isn't on screen at all (e.g. the page scrolled away mid-request).
      if (from.width < 8 || from.height < 8 || from.bottom < 0 || from.top > window.innerHeight) {
        bumpCart();
        return resolve();
      }

      const style = getComputedStyle(img);
      const clone = document.createElement('img');
      clone.src = src;
      clone.alt = '';
      clone.setAttribute('aria-hidden', 'true');
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
        borderRadius: '2px',
        pointerEvents: 'none',
        zIndex: '500',
        margin: '0',
        transformOrigin: 'center center',
        willChange: 'transform, opacity',
        boxShadow: '0 10px 28px rgba(28, 23, 18, 0.22)',
      });
      document.body.appendChild(clone);
      activeFlights += 1;

      // Centre-to-centre path. x eases in and out while y rises first, which bends the flight into a
      // gentle arc; the image shrinks towards the icon's size as it nears the cart.
      const x0 = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const x1 = to.left + to.width / 2;
      const y1 = to.top + to.height / 2;
      const endScale = Math.min(1, END_SIZE / Math.max(from.width, from.height));
      const keyframes: Keyframe[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const x = lerp(x0, x1, smooth(t));
        const y = lerp(y0, y1, 1 - Math.pow(1 - t, 2.2));
        const s = lerp(1, endScale, smooth(Math.min(1, t * 1.05)));
        keyframes.push({
          offset: t,
          transform: `translate(${x - x0}px, ${y - y0}px) scale(${s})`,
          opacity: t > 0.88 ? lerp(1, 0.35, (t - 0.88) / 0.12) : 1,
        });
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clone.remove();
        activeFlights = Math.max(0, activeFlights - 1);
        bumpCart();
        resolve();
      };
      const animation = clone.animate(keyframes, { duration: DURATION_MS, easing: 'linear', fill: 'forwards' });
      animation.onfinish = finish;
      animation.oncancel = finish;
      setTimeout(finish, DURATION_MS + 400); // safety net if the tab was throttled or the animation never reports
    } catch {
      bumpCart();
      resolve();
    }
  });
}
