'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container" style={{ padding: '100px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Something went wrong</h1>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>
        Please try again. If the problem continues, contact us via Instagram.
      </p>
      <button className="btn btn-primary" onClick={() => reset()}>
        Try Again
      </button>
    </main>
  );
}
