'use client';

import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

export type GalleryImage = { url: string; altText: string | null };

const SWIPE_THRESHOLD = 50;
const TAP_SLOP = 8;
const MAX_SCALE = 5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SCALE = 2.5;

type View = { scale: number; x: number; y: number };
const IDENTITY: View = { scale: 1, x: 0, y: 0 };

const roundBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const arrowBtn: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'rgba(255,255,255,0.85)',
  color: 'var(--ink)',
  fontSize: 20,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  zIndex: 3,
};

export function ProductGallery({
  images,
  activeIndex,
  productName,
  frameRef,
  onSelect,
  onInteract,
}: {
  images: GalleryImage[];
  activeIndex: number;
  productName: string;
  // Points at the visible image frame — the add-to-cart animation flies from it.
  frameRef?: Ref<HTMLDivElement>;
  onSelect: (index: number) => void;
  // Called on any user interaction so the parent can stop autoplay.
  onInteract: () => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const press = useRef<{ x: number; y: number } | null>(null);

  const count = images.length;
  const active = images[activeIndex] ?? images[0];

  function go(step: number) {
    if (count <= 1) return;
    onInteract();
    onSelect((activeIndex + step + count) % count);
  }

  function openLightbox() {
    onInteract();
    setLightboxOpen(true);
  }

  if (!active) {
    return (
      <div
        ref={frameRef}
        style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          background: 'var(--cream-2)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-soft)',
        }}
      >
        No image
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={frameRef}
        role="button"
        tabIndex={0}
        aria-label={`${productName} — open image to zoom`}
        onPointerDown={(e) => {
          onInteract();
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          press.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = press.current;
          press.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            go(dx < 0 ? 1 : -1);
          } else if (Math.hypot(dx, dy) < TAP_SLOP) {
            openLightbox();
          }
        }}
        onPointerCancel={() => {
          press.current = null;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openLightbox();
          } else if (e.key === 'ArrowRight') {
            go(1);
          } else if (e.key === 'ArrowLeft') {
            go(-1);
          }
        }}
        style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          background: 'var(--cream-2)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
          // Vertical scrolling stays native; horizontal drags reach us as a swipe.
          touchAction: 'pan-y',
          cursor: 'zoom-in',
          userSelect: 'none',
        }}
      >
        <Image
          key={active.url}
          src={active.url}
          alt={active.altText ?? productName}
          fill
          sizes="(max-width: 900px) 100vw, 50vw"
          style={{ objectFit: 'cover' }}
          className="mr-gallery-image"
          draggable={false}
          priority
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
          </svg>
        </span>
        {count > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {count > 1 && (
        <>
          <button type="button" aria-label="Previous image" onClick={() => go(-1)} style={{ ...arrowBtn, left: 10 }}>
            ‹
          </button>
          <button type="button" aria-label="Next image" onClick={() => go(1)} style={{ ...arrowBtn, right: 10 }}>
            ›
          </button>
        </>
      )}

      {lightboxOpen && (
        <Lightbox
          images={images}
          index={activeIndex}
          productName={productName}
          onIndexChange={onSelect}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  productName,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  productName: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const image = images[index] ?? images[0];

  function step(delta: number) {
    if (count <= 1) return;
    onIndexChange((index + delta + count) % count);
  }

  // Lock page scroll, move focus into the dialog, and put it back on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        step(1);
      } else if (e.key === 'ArrowLeft') {
        step(-1);
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!image) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} images`}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.94)' }}
    >
      {/* key remounts the stage per image, which resets its zoom and pan. */}
      <ZoomStage
        key={image.url}
        image={image}
        alt={image.altText ?? productName}
        onSwipe={step}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          {count > 1 ? `${index + 1} / ${count}` : ''}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ ...roundBtn, pointerEvents: 'auto' }}
        >
          ×
        </button>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => step(-1)}
            style={{ ...roundBtn, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => step(1)}
            style={{ ...roundBtn, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            ›
          </button>
        </>
      )}
    </div>,
    document.body
  );
}

function clampView(v: View, w: number, h: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, v.scale));
  if (scale === 1) return IDENTITY;
  const maxX = (w * scale - w) / 2;
  const maxY = (h * scale - h) / 2;
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, v.x)),
    y: Math.min(maxY, Math.max(-maxY, v.y)),
  };
}

// The zoomable picture: pinch, wheel/trackpad, double-tap and +/- buttons zoom;
// dragging pans while zoomed in and swipes to the next image at 1x.
function ZoomStage({
  image,
  alt,
  onSwipe,
}: {
  image: GalleryImage;
  alt: string;
  onSwipe: (delta: number) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(IDENTITY);
  const [smooth, setSmooth] = useState(false);
  // Handlers read the ref so rapid pointermoves never see a stale view.
  const viewRef = useRef<View>(IDENTITY);
  const onSwipeRef = useRef(onSwipe);
  useEffect(() => {
    onSwipeRef.current = onSwipe;
  });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number } | null>(null);
  const multi = useRef(false);
  const lastTap = useRef({ time: 0, x: 0, y: 0 });

  function size() {
    const r = layerRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0, left: r?.left ?? 0, top: r?.top ?? 0 };
  }

  function apply(next: View, animate = false) {
    const { w, h } = size();
    const clamped = clampView(next, w, h);
    viewRef.current = clamped;
    setSmooth(animate);
    setView(clamped);
  }

  // cx/cy are relative to the centre of the stage; that point stays put while zooming.
  function zoomAt(nextScale: number, cx: number, cy: number, animate = false) {
    const v = viewRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(1, nextScale));
    const k = scale / v.scale;
    apply({ scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, animate);
  }

  // Wheel and trackpad-pinch need a non-passive listener to stop the page zooming.
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      zoomAt(viewRef.current.scale * factor, e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // zoomAt only touches refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '+' || e.key === '=') zoomAt(viewRef.current.scale * 1.5, 0, 0, true);
      else if (e.key === '-' || e.key === '_') zoomAt(viewRef.current.scale / 1.5, 0, 0, true);
      else if (e.key === '0') apply(IDENTITY, true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is only a convenience; the gesture still works without it.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      multi.current = true;
      drag.current = null;
    } else {
      const v = viewRef.current;
      drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const { left, top, w, h } = size();
      const mx = (a.x + b.x) / 2 - (left + w / 2);
      const my = (a.y + b.y) / 2 - (top + h / 2);
      zoomAt(viewRef.current.scale * (dist / pinch.current.dist), mx, my);
      pinch.current.dist = dist;
      return;
    }

    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > TAP_SLOP) d.moved = true;
    if (viewRef.current.scale > 1) {
      apply({ scale: viewRef.current.scale, x: d.vx + dx, y: d.vy + dy });
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const d = drag.current;

    if (pointers.current.size === 1) {
      // One finger lifted after a pinch: carry on panning with the other one.
      const [rest] = Array.from(pointers.current.values());
      const v = viewRef.current;
      drag.current = { x: rest.x, y: rest.y, vx: v.x, vy: v.y, moved: true };
      pinch.current = null;
      return;
    }
    if (pointers.current.size > 1) return;

    drag.current = null;
    pinch.current = null;
    const wasMulti = multi.current;
    multi.current = false;
    if (!d || wasMulti) return;

    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (!d.moved) {
      const now = Date.now();
      const t = lastTap.current;
      if (now - t.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
        lastTap.current = { time: 0, x: 0, y: 0 };
        if (viewRef.current.scale > 1) {
          apply(IDENTITY, true);
        } else {
          const { left, top, w, h } = size();
          zoomAt(DOUBLE_TAP_SCALE, e.clientX - (left + w / 2), e.clientY - (top + h / 2), true);
        }
      } else {
        lastTap.current = { time: now, x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (viewRef.current.scale === 1 && Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      onSwipeRef.current(dx < 0 ? 1 : -1);
    }
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      drag.current = null;
      multi.current = false;
    }
    pinch.current = null;
  }

  const zoomed = view.scale > 1;

  return (
    <>
      <div
        ref={layerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          touchAction: 'none',
          cursor: zoomed ? 'grab' : 'zoom-in',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: smooth ? 'transform 0.2s ease' : 'none',
            willChange: 'transform',
          }}
        >
          <Image
            src={image.url}
            alt={alt}
            fill
            sizes="200vw"
            quality={90}
            draggable={false}
            style={{ objectFit: 'contain', pointerEvents: 'none' }}
            priority
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomAt(viewRef.current.scale / 1.5, 0, 0, true)}
          disabled={!zoomed}
          style={{ ...roundBtn, pointerEvents: 'auto', opacity: zoomed ? 1 : 0.4, cursor: zoomed ? 'pointer' : 'default' }}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomAt(viewRef.current.scale * 1.5, 0, 0, true)}
          disabled={view.scale >= MAX_SCALE}
          style={{ ...roundBtn, pointerEvents: 'auto', opacity: view.scale >= MAX_SCALE ? 0.4 : 1 }}
        >
          +
        </button>
      </div>
    </>
  );
}
