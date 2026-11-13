'use client';

import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

export function AccountLogoutButton() {
  const router = useRouter();

  async function logout() {
    const response = await fetch('/api/account/logout', { method: 'POST' });
    if (!response.ok) return;

    posthog.reset();
    router.push('/');
    router.refresh();
  }

  return (
    <button onClick={logout} className="btn btn-outline" style={{ padding: '8px 16px', minHeight: 36 }}>
      Log Out
    </button>
  );
}
