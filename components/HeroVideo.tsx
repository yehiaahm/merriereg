'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { preload } from 'react-dom';

// First frame of the clip, so the hand-off from poster to playback is invisible.
const POSTER_SRC = '/hero/hero-poster.webp';
// Front-facing frame shown when the video doesn't autoplay; pressing play resumes from it.
const STILL_SRC = '/hero/hero-still.webp';
const STILL_TIME = 1.4;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// Reduced-motion and Data Saver visitors get the still frame instead of autoplay.
function prefersStillFrame() {
  return (
    window.matchMedia(REDUCED_MOTION).matches || (navigator as NavigatorWithConnection).connection?.saveData === true
  );
}

/**
 * Background layers and playback control for the homepage hero. Rendered inside `.mr-hero`,
 * which slides up under the transparent nav — see "Hero: Cinematic Video" in globals.css.
 */
export function HeroVideo() {
  preload(POSTER_SRC, { as: 'image', fetchPriority: 'high' });

  const videoRef = useRef<HTMLVideoElement>(null);
  const wantsPlaybackRef = useRef(false);
  const prefersStill = useSyncExternalStore(subscribeToMotionPreference, prefersStillFrame, () => false);
  const [autoplay, setAutoplay] = useState<'pending' | 'started' | 'blocked'>('pending');
  const [isPlaying, setIsPlaying] = useState(false);

  // Mirror the real header heights into CSS so the hero fills the viewport exactly (the nav can wrap).
  useEffect(() => {
    const nav = document.getElementById('mrNav');
    const promo = document.getElementById('mrTop');
    if (!nav || !promo) return;
    const root = document.documentElement;
    const sync = () => {
      // The mobile menu expands inside the nav; leave it out so the hero doesn't jump while it opens.
      const menu = nav.querySelector<HTMLElement>('.mr-mobile-menu');
      const menuSpace = menu ? menu.offsetHeight + parseFloat(getComputedStyle(menu).marginTop) : 0;
      root.style.setProperty('--mr-nav-h', `${nav.offsetHeight - menuSpace}px`);
      root.style.setProperty('--mr-promo-h', `${promo.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(nav);
    observer.observe(promo);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--mr-nav-h');
      root.style.removeProperty('--mr-promo-h');
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // React doesn't render `muted` into the server HTML, and browsers only autoplay muted video.
    video.muted = true;
    if (prefersStillFrame()) return;

    let active = true;
    wantsPlaybackRef.current = true;
    video.play().then(
      () => {
        if (active) setAutoplay('started');
      },
      (error: DOMException) => {
        // AbortError just means it was paused (e.g. scrolled away) before the first frame.
        if (!active || error.name === 'AbortError') return;
        wantsPlaybackRef.current = false;
        setAutoplay('blocked');
      }
    );
    return () => {
      active = false;
    };
  }, []);

  // Don't decode frames nobody can see.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
      else if (wantsPlaybackRef.current) video.play().catch(() => {});
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const showStill = prefersStill || autoplay === 'blocked';

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      wantsPlaybackRef.current = false;
      video.pause();
      return;
    }
    wantsPlaybackRef.current = true;
    if (showStill && video.currentTime === 0) video.currentTime = STILL_TIME;
    video.play().catch(() => {});
  }

  return (
    <>
      <div className="mr-hero-media" aria-hidden="true">
        <div className="mr-hero-ambient" />
        <div className="mr-hero-frame">
          <video
            ref={videoRef}
            className="mr-hero-video"
            poster={showStill ? STILL_SRC : POSTER_SRC}
            muted
            loop
            playsInline
            preload="none"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src="/hero/hero-720.mp4" type="video/mp4" media="(max-width: 767px)" />
            <source src="/hero/hero-1080.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="mr-hero-shade" />
      </div>

      <button
        type="button"
        className="mr-hero-toggle"
        data-ready={prefersStill || autoplay !== 'pending'}
        onClick={togglePlayback}
        aria-label={isPlaying ? 'Pause background video' : 'Play background video'}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="1" width="2.5" height="10" rx="0.5" fill="currentColor" />
            <rect x="7.5" y="1" width="2.5" height="10" rx="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 1.4v9.2a.5.5 0 0 0 .76.43l7.4-4.6a.5.5 0 0 0 0-.86l-7.4-4.6A.5.5 0 0 0 3 1.4Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
