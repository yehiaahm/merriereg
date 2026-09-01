// Shared date-range model for every analytics widget, so the dashboard and
// the analytics page can never disagree about what "today" or "this month"
// means, and every chart/KPI stays in sync when the admin changes the range.
//
// All boundaries are computed against Africa/Cairo local time using a fixed
// +2:00 offset (Egypt abolished DST in 2023, so this is a stable year-round
// offset — no need for a timezone/date library just for this). Every range
// is a half-open interval [start, end) in UTC instants, which sidesteps
// inclusive/exclusive off-by-one bugs at day boundaries.

export const CAIRO_OFFSET_MS = 2 * 60 * 60 * 1000;

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisWeek'
  | 'thisMonth'
  | 'prevMonth'
  | 'thisYear'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

/** Midnight (Cairo-local) of the given UTC instant, expressed as a UTC instant. */
function cairoMidnightUtc(instant: Date): Date {
  const cairoMs = instant.getTime() + CAIRO_OFFSET_MS;
  const cairoDayStart = Math.floor(cairoMs / 86_400_000) * 86_400_000;
  return new Date(cairoDayStart - CAIRO_OFFSET_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Parses a `YYYY-MM-DD` string as Cairo-local midnight. Throws on invalid input. */
function parseCairoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  const [, y, m, d] = match;
  const utcMidnight = Date.UTC(Number(y), Number(m) - 1, Number(d));
  return new Date(utcMidnight - CAIRO_OFFSET_MS);
}

export class InvalidDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDateRangeError';
  }
}

/**
 * Resolves a preset (or explicit custom start/end, as `YYYY-MM-DD` Cairo-local
 * dates) into a concrete [start, end) UTC range.
 */
export function resolveDateRange(preset: DateRangePreset, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const todayStart = cairoMidnightUtc(now);

  switch (preset) {
    case 'today':
      return { start: todayStart, end: addDays(todayStart, 1) };
    case 'yesterday':
      return { start: addDays(todayStart, -1), end: todayStart };
    case 'last7':
      return { start: addDays(todayStart, -7), end: addDays(todayStart, 1) };
    case 'last30':
      return { start: addDays(todayStart, -30), end: addDays(todayStart, 1) };
    case 'thisWeek': {
      // Monday-start week.
      const cairoDow = new Date(now.getTime() + CAIRO_OFFSET_MS).getUTCDay(); // 0=Sun..6=Sat
      const daysSinceMonday = (cairoDow + 6) % 7;
      return { start: addDays(todayStart, -daysSinceMonday), end: addDays(todayStart, 1) };
    }
    case 'thisMonth': {
      const cairoNow = new Date(now.getTime() + CAIRO_OFFSET_MS);
      const monthStartUtcMs = Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth(), 1);
      return { start: new Date(monthStartUtcMs - CAIRO_OFFSET_MS), end: addDays(todayStart, 1) };
    }
    case 'prevMonth': {
      const cairoNow = new Date(now.getTime() + CAIRO_OFFSET_MS);
      const thisMonthStartMs = Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth(), 1);
      const prevMonthStartMs = Date.UTC(cairoNow.getUTCFullYear(), cairoNow.getUTCMonth() - 1, 1);
      return {
        start: new Date(prevMonthStartMs - CAIRO_OFFSET_MS),
        end: new Date(thisMonthStartMs - CAIRO_OFFSET_MS),
      };
    }
    case 'thisYear': {
      const cairoNow = new Date(now.getTime() + CAIRO_OFFSET_MS);
      const yearStartMs = Date.UTC(cairoNow.getUTCFullYear(), 0, 1);
      return { start: new Date(yearStartMs - CAIRO_OFFSET_MS), end: addDays(todayStart, 1) };
    }
    case 'custom': {
      if (!customStart || !customEnd) {
        throw new InvalidDateRangeError('Custom range requires both start and end dates.');
      }
      const start = parseCairoDate(customStart);
      const end = addDays(parseCairoDate(customEnd), 1); // end date is inclusive from the caller's POV
      if (start >= end) {
        throw new InvalidDateRangeError('Start date must be before end date.');
      }
      return { start, end };
    }
    default:
      throw new InvalidDateRangeError(`Unknown date range preset: ${preset satisfies never}`);
  }
}

/** The immediately preceding period of equal length, for period-over-period comparisons. */
export function getPreviousPeriod(range: DateRange): DateRange {
  const lengthMs = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - lengthMs), end: new Date(range.start.getTime()) };
}
