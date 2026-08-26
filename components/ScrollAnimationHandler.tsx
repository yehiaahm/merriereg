'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollAnimationHandler() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Hero title slide-in transition (if on homepage)
    const heroTitle = document.getElementById('mrHeroTitle');
    if (heroTitle) {
      setTimeout(() => {
        heroTitle.classList.add('mr-hero-title--in');
      }, 50);
    }

    // 2. Navbar scroll glassmorphism state
    const nav = document.getElementById('mrNav');
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 10) nav.classList.add('mr-nav--scrolled');
      else nav.classList.remove('mr-nav--scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // 3. Scroll Reveal via IntersectionObserver
    const revealEls = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('reveal--visible');
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px 50px 0px' }
      );

      revealEls.forEach((el) => {
        // If element is already in initial viewport, show immediately
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('reveal--visible');
        } else {
          io.observe(el);
        }
      });

      return () => {
        window.removeEventListener('scroll', onScroll);
        io.disconnect();
      };
    } else {
      revealEls.forEach((el) => el.classList.add('reveal--visible'));
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  return null;
}
