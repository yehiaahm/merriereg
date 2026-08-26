'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const STATUS_LABELS: Record<string, string> = {
  RETURNED: 'Return Order',
};

const CONFIRM_MESSAGES: Record<string, string> = {
  RETURNED: 'Return this order? This restocks every item and marks the payment as refunded.',
};

export function OrderStatusUpdater({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = ALLOWED_TRANSITIONS[status] ?? [];

  async function updateStatus(next: string) {
    const confirmMessage = CONFIRM_MESSAGES[next];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not update status.');
      return;
    }
    router.refresh();
  }

  if (options.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No further status changes available.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((next) => (
          <button
            key={next}
            className={next === 'CANCELLED' || next === 'RETURNED' ? 'btn btn-danger' : 'btn btn-primary'}
            style={{ minHeight: 40, padding: '0 16px' }}
            disabled={busy}
            onClick={() => updateStatus(next)}
          >
            {STATUS_LABELS[next] ?? `Mark as ${next}`}
          </button>
        ))}
      </div>
      {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
