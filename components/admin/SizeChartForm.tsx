'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CIRCUMFERENCE_KEYS,
  FIT_LABELS,
  MEASUREMENT_KEYS,
  MEASUREMENT_LABELS,
  STRETCH_LABELS,
  measurementUnit,
  type FabricStretch,
  type GarmentFit,
  type MeasurementKey,
  type SizeChartBasis,
} from '@/lib/sizing/measurements';

type RangeForm = { min: string; max: string };
type RowForm = { size: string; values: Partial<Record<MeasurementKey, RangeForm>> };

export type SizeChartFormValue = {
  id?: string;
  name: string;
  basis: SizeChartBasis;
  garmentFlat: boolean;
  fit: GarmentFit | null;
  stretch: FabricStretch | null;
  source: string;
  notes: string;
  verified: boolean;
  columns: MeasurementKey[];
  rows: RowForm[];
  ease: Partial<Record<MeasurementKey, RangeForm>>;
  categoryIds: string[];
};

export const EMPTY_CHART: SizeChartFormValue = {
  name: '',
  basis: 'BODY',
  garmentFlat: false,
  fit: null,
  stretch: null,
  source: '',
  notes: '',
  verified: false,
  columns: ['CHEST', 'WAIST'],
  rows: ['S', 'M', 'L', 'XL'].map((size) => ({ size, values: {} })),
  ease: {},
  categoryIds: [],
};

// Garment dimensions that have a body counterpart can be given an "ease".
const EASE_KEYS: MeasurementKey[] = ['CHEST', 'WAIST', 'HIPS', 'INSEAM'];

function toNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function toRange(r: RangeForm | undefined, label: string): { range?: { min: number; max: number }; error?: string } {
  if (!r) return {};
  const min = toNumber(r.min);
  const max = toNumber(r.max);
  if (Number.isNaN(min) || Number.isNaN(max)) return { error: `${label}: enter numbers only.` };
  if (min === null && max === null) return {};
  // A single value means "exactly this".
  const lo = min ?? max!;
  const hi = max ?? min!;
  return { range: { min: lo, max: hi } };
}

export function SizeChartForm({
  initial = EMPTY_CHART,
  categories,
}: {
  initial?: SizeChartFormValue;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState<SizeChartFormValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const garment = form.basis === 'GARMENT';
  const patch = (p: Partial<SizeChartFormValue>) => setForm((f) => ({ ...f, ...p }));

  function toggleColumn(key: MeasurementKey) {
    setForm((f) => ({
      ...f,
      columns: f.columns.includes(key) ? f.columns.filter((k) => k !== key) : MEASUREMENT_KEYS.filter((k) => k === key || f.columns.includes(k)),
    }));
  }

  function setCell(rowIndex: number, key: MeasurementKey, part: 'min' | 'max', value: string) {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, i) =>
        i === rowIndex ? { ...r, values: { ...r.values, [key]: { min: r.values[key]?.min ?? '', max: r.values[key]?.max ?? '', [part]: value } } } : r
      ),
    }));
  }

  function setEase(key: MeasurementKey, part: 'min' | 'max', value: string) {
    setForm((f) => ({ ...f, ease: { ...f.ease, [key]: { min: f.ease[key]?.min ?? '', max: f.ease[key]?.max ?? '', [part]: value } } }));
  }

  function moveRow(index: number, dir: -1 | 1) {
    setForm((f) => {
      const target = index + dir;
      if (target < 0 || target >= f.rows.length) return f;
      const rows = [...f.rows];
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { ...f, rows };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sizes: { size: string; measurements: Record<string, { min: number; max: number }> }[] = [];
    for (const row of form.rows) {
      const measurements: Record<string, { min: number; max: number }> = {};
      for (const key of form.columns) {
        const { range, error: err } = toRange(row.values[key], `${row.size || 'Row'} ${MEASUREMENT_LABELS[key].toLowerCase()}`);
        if (err) return setError(err);
        if (range) measurements[key] = range;
      }
      sizes.push({ size: row.size, measurements });
    }
    const ease: Record<string, { min: number; max: number }> = {};
    if (garment) {
      for (const key of EASE_KEYS.filter((k) => form.columns.includes(k))) {
        const { range, error: err } = toRange(form.ease[key], `${MEASUREMENT_LABELS[key]} ease`);
        if (err) return setError(err);
        if (range) ease[key] = range;
      }
    }

    const payload = {
      name: form.name,
      basis: form.basis,
      garmentFlat: garment && form.garmentFlat,
      fit: form.fit,
      stretch: form.stretch,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      verified: form.verified,
      sizes,
      ease,
      categoryIds: form.categoryIds,
    };

    setSubmitting(true);
    const res = await fetch(isEdit ? `/api/admin/size-charts/${initial.id}` : '/api/admin/size-charts', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setError(data.error ?? 'Could not save size chart.');

    router.push('/admin/size-charts');
    router.refresh();
  }

  async function handleDelete() {
    if (!initial.id) return;
    if (!window.confirm('Delete this size chart? Products using it will stop showing Find My Size.')) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/size-charts/${initial.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) return setError('Could not delete size chart.');
    router.push('/admin/size-charts');
    router.refresh();
  }

  const cell = (rowIndex: number, key: MeasurementKey, part: 'min' | 'max') => (
    <input
      className="admin-input"
      inputMode="decimal"
      style={{ width: 64 }}
      aria-label={`${form.rows[rowIndex].size || 'Row ' + (rowIndex + 1)} ${MEASUREMENT_LABELS[key]} ${part === 'min' ? 'minimum' : 'maximum'}`}
      value={form.rows[rowIndex].values[key]?.[part] ?? ''}
      onChange={(e) => setCell(rowIndex, key, part, e.target.value)}
    />
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 920 }}>
      {error && (
        <div role="alert" style={{ background: '#fdecea', border: '1px solid var(--danger)', padding: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Chart</legend>
        <div className="field">
          <label htmlFor="sc-name">Name</label>
          <input id="sc-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Oversized tees" required />
        </div>

        <div className="field">
          <label htmlFor="sc-basis">What do the numbers describe?</label>
          <select id="sc-basis" value={form.basis} onChange={(e) => patch({ basis: e.target.value as SizeChartBasis })}>
            <option value="BODY">Body measurements — the body each size is intended for</option>
            <option value="GARMENT">Garment measurements — the product itself, laid flat or measured round</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {garment
              ? 'Garment numbers are converted to a body size using the “ease” you enter below (how much roomier the garment is than the body). Without ease they are shown to customers but never used for recommendations.'
              : 'Used as-is: a customer whose measurements fall in a size’s range is matched to that size.'}
          </span>
        </div>

        {garment && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={form.garmentFlat} onChange={(e) => patch({ garmentFlat: e.target.checked })} />
            Chest / waist / hips were measured flat (half the full circumference)
          </label>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="sc-fit">Cut (optional)</label>
            <select id="sc-fit" value={form.fit ?? ''} onChange={(e) => patch({ fit: (e.target.value || null) as GarmentFit | null })}>
              <option value="">Not specified</option>
              {Object.entries(FIT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sc-stretch">Fabric stretch (optional)</label>
            <select id="sc-stretch" value={form.stretch ?? ''} onChange={(e) => patch({ stretch: (e.target.value || null) as FabricStretch | null })}>
              <option value="">Not specified</option>
              {Object.entries(STRETCH_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Measurements</legend>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
          Choose the columns your source gives you. Lengths and circumferences are in <strong>cm</strong>, weight in <strong>kg</strong>.
          Enter a min and max per size; a single number means exactly that value. List sizes from smallest to largest.
          Leave a cell empty if you don’t have the value — never estimate.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 14 }}>
          {MEASUREMENT_KEYS.map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={form.columns.includes(key)} onChange={() => toggleColumn(key)} />
              {MEASUREMENT_LABELS[key]} ({measurementUnit(key)})
            </label>
          ))}
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Size</th>
                {form.columns.map((key) => (
                  <th scope="col" key={key}>
                    {MEASUREMENT_LABELS[key]} {measurementUnit(key)}
                    {garment && form.garmentFlat && CIRCUMFERENCE_KEYS.includes(key) ? ' (flat)' : ''}
                    <div style={{ fontWeight: 400, fontSize: 11 }}>min – max</div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="admin-input"
                      style={{ width: 70 }}
                      aria-label={`Size label, row ${i + 1}`}
                      value={row.size}
                      onChange={(e) => setForm((f) => ({ ...f, rows: f.rows.map((r, idx) => (idx === i ? { ...r, size: e.target.value } : r)) }))}
                      placeholder="M"
                    />
                  </td>
                  {form.columns.map((key) => (
                    <td key={key} style={{ whiteSpace: 'nowrap' }}>
                      {cell(i, key, 'min')} – {cell(i, key, 'max')}
                    </td>
                  ))}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-outline" style={{ minHeight: 30, padding: '0 8px' }} onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label="Move size up">
                      ↑
                    </button>{' '}
                    <button type="button" className="btn btn-outline" style={{ minHeight: 30, padding: '0 8px' }} onClick={() => moveRow(i, 1)} disabled={i === form.rows.length - 1} aria-label="Move size down">
                      ↓
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ minHeight: 30, padding: '0 8px' }}
                      onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((_, idx) => idx !== i) }))}
                      disabled={form.rows.length === 1}
                      aria-label={`Remove size ${row.size}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-outline" style={{ marginTop: 10 }} onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, { size: '', values: {} }] }))}>
          + Add size
        </button>
      </fieldset>

      {garment && (
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Ease (garment charts)</legend>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
            How many cm bigger than the wearer’s body the finished garment is designed to be, from your tech pack or fit notes.
            Example: a tee with a 106 cm round chest meant to sit 14–20 cm roomy fits a body of 86–92 cm. Can be negative for
            garments cut smaller than the body. Leave empty if you don’t know — that measurement then won’t be used.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {EASE_KEYS.filter((k) => form.columns.includes(k)).map((key) => (
              <div key={key} className="field" style={{ minWidth: 150 }}>
                <label htmlFor={`ease-${key}-min`}>{MEASUREMENT_LABELS[key]} ease (cm)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input id={`ease-${key}-min`} className="admin-input" inputMode="decimal" style={{ width: 70 }} aria-label={`${MEASUREMENT_LABELS[key]} ease minimum`} value={form.ease[key]?.min ?? ''} onChange={(e) => setEase(key, 'min', e.target.value)} />
                  –
                  <input className="admin-input" inputMode="decimal" style={{ width: 70 }} aria-label={`${MEASUREMENT_LABELS[key]} ease maximum`} value={form.ease[key]?.max ?? ''} onChange={(e) => setEase(key, 'max', e.target.value)} />
                </div>
              </div>
            ))}
            {EASE_KEYS.every((k) => !form.columns.includes(k)) && (
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Add a chest, waist, hips or inseam column to enter its ease.</span>
            )}
          </div>
        </fieldset>
      )}

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Source &amp; publishing</legend>
        <div className="field">
          <label htmlFor="sc-source">Where do these numbers come from?</label>
          <input id="sc-source" value={form.source} onChange={(e) => patch({ source: e.target.value })} placeholder="e.g. Factory spec sheet, March 2026 sample measured by us" />
        </div>
        <div className="field">
          <label htmlFor="sc-notes">Note shown under the chart (optional)</label>
          <textarea id="sc-notes" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="e.g. Measurements taken on a pre-washed sample; allow ±1 cm." />
        </div>

        <div className="field">
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            Use as the default chart for these categories
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {categories.length === 0 && <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No categories yet.</span>}
            {categories.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.categoryIds.includes(c.id)}
                  onChange={(e) => patch({ categoryIds: e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((id) => id !== c.id) })}
                />
                {c.name}
              </label>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            A category can have one chart. To use a chart for a single product, pick it on that product’s edit page instead.
          </span>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, background: 'var(--cream-2)', padding: 12, border: '1px solid var(--line)' }}>
          <input type="checkbox" style={{ marginTop: 3 }} checked={form.verified} onChange={(e) => patch({ verified: e.target.checked })} />
          <span>
            <strong>Verified — show Find My Size to customers.</strong>
            <br />
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              Tick only when these numbers have been checked against a real source. Unverified charts are saved as drafts and
              never used on the storefront.
            </span>
          </span>
        </label>
      </fieldset>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Size Chart'}
        </button>
        {isEdit && (
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}
