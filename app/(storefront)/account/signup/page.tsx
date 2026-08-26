'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/account/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not create your account.');
      return;
    }
    router.push(searchParams.get('next') || '/account');
    router.refresh();
  }

  return (
    <main className="container" style={{ maxWidth: 380, margin: '0 auto', padding: '100px 24px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Create an Account</h1>
      <form onSubmit={handleSubmit} className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />

        <label htmlFor="email" style={{ marginTop: 12 }}>
          Email
        </label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="phone" style={{ marginTop: 12 }}>
          Phone (optional)
        </label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010xxxxxxxx" />

        <label htmlFor="password" style={{ marginTop: 12 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, color: 'var(--ink-soft)' }}>
        Already have an account?{' '}
        <Link href="/account/login" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
          Sign in
        </Link>
      </p>
    </main>
  );
}

export default function CustomerSignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
