'use client';

import { useState } from 'react';
import { useDateRange, type PresetKey } from './DateRangeContext';

const PRESET_LABELS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: '7 Days' },
  { key: 'last30', label: '30 Days' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'prevMonth', label: 'Prev Month' },
  { key: 'thisYear', label: 'This Year' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DateRangePicker() {
  const { range, setRange } = useDateRange();
  const [customStart, setCustomStart] = useState(range.start ?? todayIso());
  const [customEnd, setCustomEnd] = useState(range.end ?? todayIso());

  return (
    <div className="admin-filter-bar" role="group" aria-label="Date range">
      <div className="admin-btn-group">
        {PRESET_LABELS.map((p) => (
          <button key={p.key} type="button" aria-pressed={range.preset === p.key} onClick={() => setRange({ preset: p.key })}>
            {p.label}
          </button>
        ))}
        <button type="button" aria-pressed={range.preset === 'custom'} onClick={() => setRange({ preset: 'custom', start: customStart, end: customEnd })}>
          Custom
        </button>
      </div>
      {range.preset === 'custom' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            className="admin-input"
            value={customStart}
            max={customEnd}
            onChange={(e) => {
              setCustomStart(e.target.value);
              setRange({ preset: 'custom', start: e.target.value, end: customEnd });
            }}
          />
          <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>to</span>
          <input
            type="date"
            className="admin-input"
            value={customEnd}
            min={customStart}
            max={todayIso()}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setRange({ preset: 'custom', start: customStart, end: e.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
}
