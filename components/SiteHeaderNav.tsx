'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SiteHeaderNav({
  itemCount,
  wishlistCount,
  customerName,
  isAdmin,
}: {
  itemCount: number;
  wishlistCount: number;
  customerName: string | null;
  isAdmin: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // On the homepage the nav floats transparently over the video hero until the page scrolls.
  // A data attribute (not a class) so React re-renders never wipe the `mr-nav--scrolled` class.
  const overHero = usePathname() === '/' && !mobileMenuOpen;

  return (
    <nav className="mr-nav" id="mrNav" data-overlay={overHero}>
      <Link href="/" className="mr-wordmark">
        <span className="mr-wordmark-dot" />
        MERRIER
      </Link>

      <div className="mr-nav-links">
        <Link href="/#collection">Collection</Link>
        <Link href="/products">Shop</Link>
        <Link
          href="/cart"
          data-cart-target
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Cart
          <span className={`mr-nav-count${itemCount > 0 ? ' mr-nav-count--active' : ''}`}>{itemCount}</span>
        </Link>
        <Link
          href="/wishlist"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Wishlist
          <span className={`mr-nav-count${wishlistCount > 0 ? ' mr-nav-count--active' : ''}`}>{wishlistCount}</span>
        </Link>
        <Link href="/track-order">Track Order</Link>
        <Link href={customerName ? '/account' : '/account/login'}>{customerName ? customerName.split(' ')[0] : 'Sign In'}</Link>
        {isAdmin && <Link href="/admin">Admin</Link>}
        <a className="mr-nav-cta" href="https://instagram.com/merriereg" target="_blank" rel="noopener">
          @merriereg
        </a>
      </div>

      <div className="mr-nav-actions">
        <Link href="/cart" className="mr-nav-cart" data-cart-target aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5.2 8.2h13.6l-1 11.2a1.5 1.5 0 0 1-1.5 1.35H7.7a1.5 1.5 0 0 1-1.5-1.35L5.2 8.2Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className={`mr-nav-count${itemCount > 0 ? ' mr-nav-count--active' : ''}`} aria-hidden="true">
            {itemCount}
          </span>
        </Link>
        <button
          className={`mr-menu-btn ${mobileMenuOpen ? 'mr-menu-btn--open' : ''}`}
          id="mrMenuBtn"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`mr-mobile-menu ${mobileMenuOpen ? 'mr-mobile-menu--open' : ''}`} id="mrMobileMenu">
        <Link href="/" onClick={() => setMobileMenuOpen(false)}>
          Home
        </Link>
        <Link href="/products" onClick={() => setMobileMenuOpen(false)}>
          Shop All
        </Link>
        <Link href="/#collection" onClick={() => setMobileMenuOpen(false)}>
          Collection
        </Link>
        <Link href="/cart" onClick={() => setMobileMenuOpen(false)}>
          Cart ({itemCount})
        </Link>
        <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)}>
          Wishlist ({wishlistCount})
        </Link>
        <Link href="/track-order" onClick={() => setMobileMenuOpen(false)}>
          Track Order
        </Link>
        <Link href={customerName ? '/account' : '/account/login'} onClick={() => setMobileMenuOpen(false)}>
          {customerName ? `Account (${customerName.split(' ')[0]})` : 'Sign In'}
        </Link>
        {isAdmin && (
          <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
            Admin Dashboard
          </Link>
        )}
        <a href="https://instagram.com/merriereg" target="_blank" rel="noopener" onClick={() => setMobileMenuOpen(false)}>
          @merriereg (Instagram)
        </a>
      </div>
    </nav>
  );
}
