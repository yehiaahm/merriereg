// Validation for admin-entered size charts. The same schema guards the admin
// API (on save) and the storefront loader (on read), so a chart that is
// malformed — however it got into the database — is dropped instead of
// producing a wrong recommendation.

import { z } from 'zod';
import {
  CHART_VALUE_LIMITS,
  EASE_LIMITS,
  MEASUREMENT_KEYS,
  MEASUREMENT_LABELS,
  PRELIMINARY_KEYS,
  measurementUnit,
  normalizeSizeLabel,
  type MeasurementKey,
  type Range,
  type SizeChartData,
} from './measurements';

const rangeSchema = z
  .object({ min: z.number().finite(), max: z.number().finite() })
  .refine((r) => r.min <= r.max, 'Minimum can’t be larger than maximum.');

const measurementsSchema = z.record(z.enum(MEASUREMENT_KEYS), rangeSchema);

export const sizeChartInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the chart a name.').max(120),
    basis: z.enum(['BODY', 'GARMENT']),
    garmentFlat: z.boolean().default(false),
    fit: z.enum(['SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED']).nullable().default(null),
    stretch: z.enum(['NONE', 'LOW', 'MODERATE', 'HIGH']).nullable().default(null),
    notes: z.string().trim().max(1000).nullable().default(null),
    source: z.string().trim().max(500).nullable().default(null),
    verified: z.boolean().default(false),
    sizes: z
      .array(z.object({ size: z.string().trim().min(1, 'Every row needs a size label.').max(20), measurements: measurementsSchema }))
      .min(1, 'Add at least one size.')
      .max(20),
    ease: z.record(z.enum(MEASUREMENT_KEYS), rangeSchema).default({}),
  })
  .superRefine((chart, ctx) => {
    const fail = (message: string, path: (string | number)[] = []) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

    // Unique size labels (compared loosely, as the storefront does).
    const seen = new Set<string>();
    chart.sizes.forEach((row, i) => {
      const norm = normalizeSizeLabel(row.size);
      if (seen.has(norm)) fail(`Size “${row.size}” appears twice.`, ['sizes', i, 'size']);
      seen.add(norm);
    });

    // Plausible values, in the right units.
    chart.sizes.forEach((row, i) => {
      for (const key of MEASUREMENT_KEYS) {
        const r = row.measurements[key];
        if (!r) continue;
        const { min, max } = CHART_VALUE_LIMITS[key];
        if (r.min < min || r.max > max) {
          fail(
            `${row.size} ${MEASUREMENT_LABELS[key].toLowerCase()} must be between ${min} and ${max} ${measurementUnit(key)}.`,
            ['sizes', i, 'measurements', key]
          );
        }
      }
    });

    // Rows are ordered smallest → largest, so each measurement must not go
    // backwards from one size to the next — the engine relies on this.
    for (const key of MEASUREMENT_KEYS) {
      let prev: { size: string; range: Range } | null = null;
      for (const row of chart.sizes) {
        const r = row.measurements[key];
        if (!r) continue;
        if (prev && (r.min < prev.range.min || r.max < prev.range.max)) {
          fail(
            `${MEASUREMENT_LABELS[key]} for ${row.size} is smaller than for ${prev.size}. List sizes from smallest to largest.`,
            ['sizes']
          );
          break;
        }
        prev = { size: row.size, range: r };
      }
    }

    // Garment charts: ease is what lets garment numbers be compared with a body.
    for (const key of MEASUREMENT_KEYS) {
      const e = chart.ease[key];
      if (!e) continue;
      if (e.min < EASE_LIMITS.min || e.max > EASE_LIMITS.max) {
        fail(`${MEASUREMENT_LABELS[key]} ease must be between ${EASE_LIMITS.min} and ${EASE_LIMITS.max} cm.`, ['ease', key]);
      }
      if (chart.basis === 'BODY') fail('Ease only applies to garment charts.', ['ease', key]);
    }

    if (chart.verified) {
      if (!chart.source || chart.source.length < 3) {
        fail('Say where these measurements come from before marking the chart verified.', ['source']);
      }
      const usable = chart.sizes.some((row) =>
        (Object.keys(row.measurements) as MeasurementKey[]).some(
          (key) =>
            !['LENGTH', 'SHOULDER', 'SLEEVE'].includes(key) &&
            (chart.basis === 'BODY' || PRELIMINARY_KEYS.includes(key) || chart.ease[key])
        )
      );
      if (!usable) {
        fail(
          chart.basis === 'GARMENT'
            ? 'A verified garment chart needs at least one chest, waist, hips or inseam column with its ease filled in (or height/weight ranges).'
            : 'A verified chart needs at least one body measurement column (height, weight, chest, waist, hips or inseam).',
          ['sizes']
        );
      }
    }
  });

export type SizeChartInput = z.infer<typeof sizeChartInputSchema>;

// Admin request body: the chart plus the categories it is the default for.
export const sizeChartRequestSchema = z
  .object({ categoryIds: z.array(z.string().min(1)).max(100).default([]) })
  .and(sizeChartInputSchema);

/**
 * Turns a database row into the storefront's chart, or null if the stored
 * JSON doesn't pass validation.
 */
export function parseStoredChart(row: {
  id: string;
  name: string;
  basis: string;
  garmentFlat: boolean;
  fit: string | null;
  stretch: string | null;
  notes: string | null;
  source: string | null;
  verified: boolean;
  sizes: unknown;
  ease: unknown;
}): SizeChartData | null {
  const parsed = sizeChartInputSchema.safeParse({
    name: row.name,
    basis: row.basis,
    garmentFlat: row.garmentFlat,
    fit: row.fit,
    stretch: row.stretch,
    notes: row.notes,
    source: row.source,
    verified: row.verified,
    sizes: row.sizes,
    ease: row.ease ?? {},
  });
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    id: row.id,
    name: c.name,
    basis: c.basis,
    garmentFlat: c.basis === 'GARMENT' && c.garmentFlat,
    fit: c.fit,
    stretch: c.stretch,
    notes: c.notes,
    sizes: c.sizes,
    ease: c.basis === 'GARMENT' ? c.ease : {},
  };
}
