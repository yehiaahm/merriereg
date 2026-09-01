import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { resolveDateRange, InvalidDateRangeError, type DateRange, type DateRangePreset } from './dates';

const PRESETS = ['today', 'yesterday', 'last7', 'last30', 'thisWeek', 'thisMonth', 'prevMonth', 'thisYear', 'custom'] as const;

const rangeQuerySchema = z.object({
  preset: z.enum(PRESETS).default('last30'),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export class RangeParseError extends Error {}

/** Parses `?preset=&start=&end=` search params into a concrete DateRange, shared by every analytics API route. */
export function parseDateRangeParams(req: NextRequest): DateRange {
  const parsed = rangeQuerySchema.safeParse({
    preset: req.nextUrl.searchParams.get('preset') ?? undefined,
    start: req.nextUrl.searchParams.get('start') ?? undefined,
    end: req.nextUrl.searchParams.get('end') ?? undefined,
  });
  if (!parsed.success) {
    throw new RangeParseError(parsed.error.issues[0]?.message ?? 'Invalid date range parameters');
  }
  try {
    return resolveDateRange(parsed.data.preset as DateRangePreset, parsed.data.start, parsed.data.end);
  } catch (err) {
    if (err instanceof InvalidDateRangeError) throw new RangeParseError(err.message);
    throw err;
  }
}

export const GRANULARITIES = ['day', 'week', 'month'] as const;
export function parseGranularity(req: NextRequest): 'day' | 'week' | 'month' {
  const value = req.nextUrl.searchParams.get('granularity');
  return (GRANULARITIES as readonly string[]).includes(value ?? '') ? (value as 'day' | 'week' | 'month') : 'day';
}
