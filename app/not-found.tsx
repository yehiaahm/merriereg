import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container" style={{ padding: '100px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 40, marginBottom: 12 }}>Not Found</h1>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>
        We couldn&apos;t find what you were looking for.
      </p>
      <Link href="/products" className="btn btn-primary">
        Continue Shopping
      </Link>
    </main>
  );
}
