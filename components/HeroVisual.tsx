'use client';

import { useMemo, useEffect, useRef } from 'react';

type Dot = {
  x: string;
  y: string;
  size: string;
  opacity: string;
};

export function HeroVisual() {
  const containerRef = useRef<HTMLDivElement>(null);

  const dots = useMemo(() => {
    const list: Dot[] = [];
    const cx = 250,
      cy = 250;
    const minR = 62,
      maxR = 232,
      ringGap = 13.5;
    let idx = 0;
    for (let r = minR; r <= maxR; r += ringGap) {
      const circumference = 2 * Math.PI * r;
      const count = Math.max(8, Math.floor(circumference / 11.5));
      const t = (r - minR) / (maxR - minR);
      const size = (4.6 - t * 3.1).toFixed(2);
      const opacity = (1 - t * 0.62).toFixed(2);
      const stagger = (idx % 2) * (Math.PI / count);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + stagger;
        const x = (cx + Math.cos(angle) * r).toFixed(2);
        const y = (cy + Math.sin(angle) * r).toFixed(2);
        list.push({ x, y, size, opacity });
        idx++;
      }
    }
    return list;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Trigger initial entrance animation
    const timer = setTimeout(() => {
      el.classList.add('mr-hero-visual-inner--in');
    }, 80);

    let rafId: number | null = null;

    // Ultra-smooth 60/120fps hardware-accelerated 3D mouse parallax tilt
    if (window.matchMedia('(hover: hover)').matches) {
      const onMouseMove = (e: MouseEvent) => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          const b = el.getBoundingClientRect();
          const centerX = b.left + b.width / 2;
          const centerY = b.top + b.height / 2;
          const dx = (e.clientX - centerX) / (b.width / 2 || 1);
          const dy = (e.clientY - centerY) / (b.height / 2 || 1);
          const clampedX = Math.max(-1, Math.min(1, dx));
          const clampedY = Math.max(-1, Math.min(1, dy));
          el.style.transform = `scale(1) rotate(0deg) perspective(900px) rotateX(${(-clampedY * 6).toFixed(2)}deg) rotateY(${(clampedX * 6).toFixed(2)}deg)`;
          rafId = null;
        });
      };

      const onMouseLeave = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        el.style.transform = 'scale(1) rotate(0deg) perspective(900px) rotateX(0deg) rotateY(0deg)';
      };

      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('mouseleave', onMouseLeave, { passive: true });

      return () => {
        clearTimeout(timer);
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
      };
    }

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mr-hero-visual">
      <div className="mr-hero-visual-inner" ref={containerRef}>
        <svg className="mr-dotmark" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
          <g className="mr-dotmark-rings">
            {dots.map((dot, i) => (
              <circle
                key={i}
                className="mr-dot"
                cx={dot.x}
                cy={dot.y}
                r={dot.size}
                fill="var(--accent)"
                style={{ opacity: Number(dot.opacity) }}
              />
            ))}
          </g>
          <circle className="mr-dotmark-core" cx="250" cy="250" r="46" fill="var(--accent)" />
        </svg>
        <div className="mr-dotmark-label">
          <div className="mr-wordmark">
            <span className="mr-wordmark-dot" />
            MERRIER
          </div>
          <span className="mr-estd">ESTD 2024</span>
        </div>
      </div>
    </div>
  );
}
