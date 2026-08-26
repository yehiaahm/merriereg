'use client';

import { useRouter } from 'next/navigation';

export function AccountLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/account/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <button onClick={logout} className="btn btn-outline" style={{ padding: '8px 16px', minHeight: 36 }}>
      Log Out
    </button>
  );
}
