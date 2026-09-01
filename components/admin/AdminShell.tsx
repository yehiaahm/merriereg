'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountLogoutButton } from '@/components/AccountLogoutButton';

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  products: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 7.5v9a2 2 0 0 1-1 1.73l-6.5 3.75a2 2 0 0 1-2 0L4.5 18.23a2 2 0 0 1-1-1.73v-9a2 2 0 0 1 1-1.73L11 1.77a2 2 0 0 1 2 0l6.5 3.75a2 2 0 0 1 1 1.73Z" />
      <path d="M3.8 6.3 12 11l8.2-4.7M12 11v10" />
    </svg>
  ),
  orders: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  customers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M12 16V8M17 16v-7" />
    </svg>
  ),
  pos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.2a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  ),
};

export interface AdminNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/products', label: 'Products', icon: 'products' },
  { href: '/admin/orders', label: 'Orders', icon: 'orders' },
  { href: '/admin/customers', label: 'Customers', icon: 'customers' },
  { href: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/admin/pos', label: 'POS', icon: 'pos' },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminShell({ adminName, children }: { adminName?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever navigation happens — adjusted during
  // render (React's recommended pattern for "reset state when a prop
  // changes") rather than in an effect, so it can't cause an extra paint
  // with the drawer still open on the new page.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="admin-shell" id="admin-shell">
      <div className="admin-sidebar-overlay" data-open={open} onClick={() => setOpen(false)} />
      <aside className="admin-sidebar" data-open={open} aria-label="Admin navigation">
        <Link href="/admin" className="admin-sidebar-brand">
          MERRIER Admin
        </Link>
        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
              {ICONS[item.icon]}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          {adminName && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
              Signed in as <strong style={{ color: 'var(--ink)' }}>{adminName}</strong>
            </div>
          )}
          <AccountLogoutButton />
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="admin-topbar">
          <button className="admin-menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <Link href="/admin" style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--ink)' }}>
            MERRIER Admin
          </Link>
          <AccountLogoutButton />
        </div>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
