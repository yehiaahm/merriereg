'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Login failed.');
      return;
    }
    router.push(searchParams.get('next') || '/account');
    router.refresh();
  }

  return (
    <main className="container" style={{ maxWidth: 380, margin: '0 auto', padding: '100px 24px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Sign In</h1>
      <form onSubmit={handleSubmit} className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <label htmlFor="password" style={{ marginTop: 12 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, color: 'var(--ink-soft)' }}>
        New here?{' '}
        <Link href="/account/signup" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
          Create an account
        </Link>
      </p>
    </main>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
