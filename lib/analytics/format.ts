// Shared period-over-period comparison math, used by every KPI card so
// "previous period was zero" and rounding are handled exactly once.

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface Delta {
  current: number;
  previous: number;
  absolute: number;
  /** Percent change, or null when the previous period was zero (no meaningful percentage). */
  percent: number | null;
  direction: DeltaDirection;
  previousWasZero: boolean;
}

export function computeDelta(current: number, previous: number): Delta {
  const absolute = current - previous;
  const previousWasZero = previous === 0;
  const percent = previousWasZero ? null : (absolute / previous) * 100;
  const direction: DeltaDirection = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat';
  return { current, previous, absolute, percent, direction, previousWasZero };
}
