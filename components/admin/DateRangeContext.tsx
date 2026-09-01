'use client';

import { createContext, useContext, useMemo, useState } from 'react';

export type PresetKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisWeek' | 'thisMonth' | 'prevMonth' | 'thisYear' | 'custom';

export interface RangeState {
  preset: PresetKey;
  start?: string; // YYYY-MM-DD, only meaningful when preset === 'custom'
  end?: string;
}

interface DateRangeContextValue {
  range: RangeState;
  setRange: (range: RangeState) => void;
  queryString: string;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function rangeToQueryString(range: RangeState): string {
  const params = new URLSearchParams({ preset: range.preset });
  if (range.preset === 'custom' && range.start && range.end) {
    params.set('start', range.start);
    params.set('end', range.end);
  }
  return params.toString();
}

export function DateRangeProvider({ initial, children }: { initial?: RangeState; children: React.ReactNode }) {
  const [range, setRange] = useState<RangeState>(initial ?? { preset: 'last30' });
  const queryString = useMemo(() => rangeToQueryString(range), [range]);
  return <DateRangeContext.Provider value={{ range, setRange, queryString }}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within a DateRangeProvider');
  return ctx;
}
