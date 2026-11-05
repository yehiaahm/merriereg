'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Edit link + quick enable/disable toggle for one row of the discount-codes table. */
export function DiscountCodeRowActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/admin/discount-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    setBusy(false);
    if (!res.ok) {
      window.alert('Could not update the discount code.');
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', whiteSpace: 'nowrap' }}>
      <Link href={`/admin/discount-codes/${id}`} style={{ fontSize: 13, fontWeight: 700 }}>
        Edit
      </Link>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: active ? 'var(--danger)' : 'var(--accent)' }}
      >
        {busy ? '…' : active ? 'Disable' : 'Enable'}
      </button>
    </div>
  );
}
