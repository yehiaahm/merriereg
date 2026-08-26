'use client';

import { useState } from 'react';
import Link from 'next/link';

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

  return (
    <nav className="mr-nav" id="mrNav">
      <Link href="/" className="mr-wordmark">
        <span className="mr-wordmark-dot" />
        MERRIER
      </Link>

      <div className="mr-nav-links">
        <Link href="/#collection">Collection</Link>
        <Link href="/products">Shop</Link>
        <Link href="/#about">The Brand</Link>
        <Link
          href="/cart"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Cart
          <span
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: '50%',
              background: itemCount > 0 ? 'var(--accent)' : 'var(--line)',
              color: itemCount > 0 ? 'var(--cream)' : 'var(--ink-soft)',
              fontSize: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {itemCount}
          </span>
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
          <span
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: '50%',
              background: wishlistCount > 0 ? 'var(--accent)' : 'var(--line)',
              color: wishlistCount > 0 ? 'var(--cream)' : 'var(--ink-soft)',
              fontSize: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {wishlistCount}
          </span>
        </Link>
        <Link href={customerName ? '/account' : '/account/login'}>{customerName ? customerName.split(' ')[0] : 'Sign In'}</Link>
        {isAdmin && <Link href="/admin">Admin</Link>}
        <a className="mr-nav-cta" href="https://instagram.com/merriereg" target="_blank" rel="noopener">
          @merriereg
        </a>
      </div>

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
        <Link href="/#about" onClick={() => setMobileMenuOpen(false)}>
          The Brand
        </Link>
        <Link href="/cart" onClick={() => setMobileMenuOpen(false)}>
          Cart ({itemCount})
        </Link>
        <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)}>
          Wishlist ({wishlistCount})
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
