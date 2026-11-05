'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { describeDiscountRule } from '@/lib/promotions';

export type DiscountCodeFormValue = {
  id?: string;
  code: string;
  label: string;
  type: 'PERCENT' | 'FIXED';
  /** Whole percent for PERCENT, EGP for FIXED (kept as text while editing). */
  value: string;
  /** EGP, PERCENT only. */
  maxDiscount: string;
  /** EGP. */
  minSubtotal: string;
  usageLimit: string;
  oncePerCustomer: boolean;
  /** ISO timestamps (or '') when passed in as `initial`; datetime-local strings while editing. */
  startsAt: string;
  expiresAt: string;
  active: boolean;
  showInBar: boolean;
  showAtCheckout: boolean;
  barText: string;
  usedCount?: number;
};

export const EMPTY_DISCOUNT_CODE: DiscountCodeFormValue = {
  code: '',
  label: '',
  type: 'PERCENT',
  value: '10',
  maxDiscount: '',
  minSubtotal: '',
  usageLimit: '',
  oncePerCustomer: false,
  startsAt: '',
  expiresAt: '',
  active: true,
  showInBar: false,
  showAtCheckout: true,
  barText: '',
};

/** ISO string from the server → value for <input type="datetime-local"> in local time. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function egpToPiastres(raw: string, label: string): { value?: number; error?: string } {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '') return {};
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return { error: `${label}: enter a valid amount.` };
  return { value: Math.round(n * 100) };
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function DiscountCodeForm({ initial = EMPTY_DISCOUNT_CODE }: { initial?: DiscountCodeFormValue }) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);
  // Dates start empty and are filled in after mount: <input type="datetime-local">
  // must show the admin's own timezone, which the server render cannot know.
  const [form, setForm] = useState<DiscountCodeFormValue>({ ...initial, startsAt: '', expiresAt: '' });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync of browser-timezone dates
    setForm((f) => ({ ...f, startsAt: isoToLocalInput(initial.startsAt), expiresAt: isoToLocalInput(initial.expiresAt) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patch = (p: Partial<DiscountCodeFormValue>) => setForm((f) => ({ ...f, ...p }));
  const percent = form.type === 'PERCENT';

  // What customers will read in the promo bar, as a live preview.
  const previewValue = Number(form.value.replace(',', '.'));
  const previewRule = {
    type: form.type,
    value: Number.isFinite(previewValue) ? (percent ? previewValue : Math.round(previewValue * 100)) : 0,
  };
  const previewText =
    form.barText.trim() ||
    `${form.label.trim() || describeDiscountRule(previewRule)} (Code: ${form.code.trim() || 'YOURCODE'})`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rawValue = Number(form.value.trim().replace(',', '.'));
    if (!Number.isFinite(rawValue) || rawValue <= 0) return setError('Enter the discount value.');
    let value: number;
    if (percent) {
      if (!Number.isInteger(rawValue)) return setError('Percentage must be a whole number (e.g. 10).');
      if (rawValue > 100) return setError('A percentage discount cannot exceed 100%.');
      value = rawValue;
    } else {
      value = Math.round(rawValue * 100);
    }

    const max = egpToPiastres(form.maxDiscount, 'Maximum discount');
    if (max.error) return setError(max.error);
    const min = egpToPiastres(form.minSubtotal, 'Minimum order');
    if (min.error) return setError(min.error);

    let usageLimit: number | null = null;
    if (form.usageLimit.trim() !== '') {
      usageLimit = Number(form.usageLimit);
      if (!Number.isInteger(usageLimit) || usageLimit < 1) return setError('Usage limit must be a whole number of at least 1.');
    }

    const payload = {
      code: form.code.trim(),
      label: form.label.trim(),
      type: form.type,
      value,
      maxDiscount: percent ? (max.value ?? null) : null,
      minSubtotal: min.value ?? 0,
      usageLimit,
      oncePerCustomer: form.oncePerCustomer,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      active: form.active,
      showInBar: form.showInBar,
      showAtCheckout: form.showAtCheckout,
      barText: form.barText.trim(),
    };

    setSubmitting(true);
    const res = await fetch(isEdit ? `/api/admin/discount-codes/${initial.id}` : '/api/admin/discount-codes', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setError(data.error ?? 'Could not save the discount code.');

    router.push('/admin/discount-codes');
    router.refresh();
  }

  async function handleDelete() {
    if (!initial.id) return;
    if (!window.confirm('Delete this discount code? Customers will no longer be able to use it. Past orders are not affected.')) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/discount-codes/${initial.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) return setError('Could not delete the discount code.');
    router.push('/admin/discount-codes');
    router.refresh();
  }

  const hint = { fontSize: 12, color: 'var(--ink-soft)' } as const;
  const check = { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 } as const;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 720 }}>
      {error && (
        <div role="alert" style={{ background: '#fdecea', border: '1px solid var(--danger)', padding: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Code</legend>

        <div className="field">
          <label htmlFor="dc-code">Code customers type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="dc-code"
              value={form.code}
              onChange={(e) => patch({ code: e.target.value })}
              placeholder="e.g. SUMMER20"
              required
              maxLength={30}
              autoComplete="off"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn btn-outline" style={{ padding: '0 14px', fontSize: 13 }} onClick={() => patch({ code: randomCode() })}>
              Generate
            </button>
          </div>
          <span style={hint}>3–30 characters: letters, numbers, dot, dash. Not case-sensitive for customers.</span>
        </div>

        <div className="field">
          <label htmlFor="dc-label">Description (optional)</label>
          <input id="dc-label" value={form.label} onChange={(e) => patch({ label: e.target.value })} placeholder="e.g. Follow us & get 10% off" maxLength={80} />
          <span style={hint}>Shown next to the code at checkout and in the promo bar.</span>
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Discount</legend>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="dc-type">Type</label>
            <select id="dc-type" value={form.type} onChange={(e) => patch({ type: e.target.value as 'PERCENT' | 'FIXED' })}>
              <option value="PERCENT">Percentage off</option>
              <option value="FIXED">Fixed amount off (EGP)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="dc-value">{percent ? 'Percent off' : 'Amount off (EGP)'}</label>
            <input
              id="dc-value"
              inputMode="decimal"
              value={form.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder={percent ? '10' : '100'}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="dc-min">Minimum order (EGP, optional)</label>
            <input id="dc-min" inputMode="decimal" value={form.minSubtotal} onChange={(e) => patch({ minSubtotal: e.target.value })} placeholder="No minimum" />
          </div>
          {percent && (
            <div className="field">
              <label htmlFor="dc-max">Maximum discount (EGP, optional)</label>
              <input id="dc-max" inputMode="decimal" value={form.maxDiscount} onChange={(e) => patch({ maxDiscount: e.target.value })} placeholder="No cap" />
            </div>
          )}
        </div>
        <span style={hint}>The discount applies to the order subtotal (after any bundle pricing), never to shipping.</span>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Limits &amp; schedule</legend>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="dc-limit">Total uses allowed (optional)</label>
            <input id="dc-limit" inputMode="numeric" value={form.usageLimit} onChange={(e) => patch({ usageLimit: e.target.value })} placeholder="Unlimited" />
            {isEdit && <span style={hint}>Used so far: {initial.usedCount ?? 0}</span>}
          </div>
          <div />
          <div className="field">
            <label htmlFor="dc-start">Starts (optional)</label>
            <input id="dc-start" type="datetime-local" value={form.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="dc-end">Expires (optional)</label>
            <input id="dc-end" type="datetime-local" value={form.expiresAt} onChange={(e) => patch({ expiresAt: e.target.value })} />
          </div>
        </div>

        <label style={check}>
          <input type="checkbox" checked={form.oncePerCustomer} onChange={(e) => patch({ oncePerCustomer: e.target.checked })} />
          <span>
            One use per customer
            <br />
            <span style={hint}>Blocks the same phone number or account from using this code on a second order.</span>
          </span>
        </label>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Visibility</legend>

        <label style={check}>
          <input type="checkbox" checked={form.active} onChange={(e) => patch({ active: e.target.checked })} />
          <span>
            Active
            <br />
            <span style={hint}>Turn off to stop accepting this code immediately without deleting it.</span>
          </span>
        </label>
        <label style={check}>
          <input type="checkbox" checked={form.showInBar} onChange={(e) => patch({ showInBar: e.target.checked })} />
          <span>
            Show in the top promo bar
            <br />
            <span style={hint}>Only while the code is active, inside its dates and not used up.</span>
          </span>
        </label>
        <label style={check}>
          <input type="checkbox" checked={form.showAtCheckout} onChange={(e) => patch({ showAtCheckout: e.target.checked })} />
          <span>
            List it at checkout with Copy / Apply buttons
            <br />
            <span style={hint}>Untick for a private code you hand out directly — it still works when typed in.</span>
          </span>
        </label>

        {form.showInBar && (
          <div className="field">
            <label htmlFor="dc-bar">Custom promo bar text (optional)</label>
            <input id="dc-bar" value={form.barText} onChange={(e) => patch({ barText: e.target.value })} placeholder="Leave empty to generate it automatically" maxLength={120} />
            <span style={hint}>
              Preview:{' '}
              <strong style={{ color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{previewText}</strong>
            </span>
          </div>
        )}
      </fieldset>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting || deleting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create discount code'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => router.push('/admin/discount-codes')} disabled={submitting || deleting}>
          Cancel
        </button>
        {isEdit && (
          <button type="button" className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={handleDelete} disabled={submitting || deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}
