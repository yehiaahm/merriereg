'use client';

import Link from 'next/link';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="admin-error-state" style={{ padding: '80px 20px' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <strong style={{ fontSize: 16 }}>Something went wrong loading this page.</strong>
      <span>The data failed to load — this is not the same as there being no data.</span>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => reset()}>
          Try Again
        </button>
        <Link href="/admin" className="btn btn-outline">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
