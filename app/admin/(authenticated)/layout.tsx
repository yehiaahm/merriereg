import Link from 'next/link';
import { AccountLogoutButton } from '@/components/AccountLogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '16px 24px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--cream)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
          <Link href="/admin" style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--ink)' }}>
            MERRIER Admin
          </Link>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
            <Link href="/admin" style={{ color: 'var(--ink)' }}>
              Dashboard
            </Link>
            <Link href="/admin/products" style={{ color: 'var(--ink)' }}>
              Products
            </Link>
            <Link href="/admin/orders" style={{ color: 'var(--ink)' }}>
              Orders
            </Link>
            <Link href="/admin/pos" style={{ color: 'var(--ink)' }}>
              POS
            </Link>
          </nav>
        </div>
        <AccountLogoutButton />
      </div>
      <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', overflowX: 'hidden' }}>{children}</div>
    </div>
  );
}
