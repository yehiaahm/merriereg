// Shared vocabulary for size charts and the Find My Size engine. Plain
// constants and types only (no Prisma import), so it's safe to bundle into
// client components — the recommendation itself runs in the customer's
// browser and their measurements never leave it.
//
// Units are fixed, never mixed: every length/circumference is centimetres,
// weight is kilograms. Both the admin chart editor and the customer form
// collect values in exactly these units.

export const MEASUREMENT_KEYS = [
  'HEIGHT',
  'WEIGHT',
  'CHEST',
  'WAIST',
  'HIPS',
  'INSEAM',
  'LENGTH',
  'SHOULDER',
  'SLEEVE',
] as const;

export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

// Measurements a customer can be asked for and compared against a chart.
export const CUSTOMER_MEASUREMENT_KEYS = ['HEIGHT', 'WEIGHT', 'CHEST', 'WAIST', 'HIPS', 'INSEAM'] as const;
export type CustomerMeasurementKey = (typeof CUSTOMER_MEASUREMENT_KEYS)[number];

// Height and weight say little about how a specific garment fits (two people
// of the same height and weight can need different sizes), so they're only
// ever preliminary indicators — see lib/sizing/engine.ts for how that caps
// confidence.
export const PRELIMINARY_KEYS: readonly MeasurementKey[] = ['HEIGHT', 'WEIGHT'];

// Direct body measurements, in the order the form asks for them.
export const DIRECT_KEYS: readonly CustomerMeasurementKey[] = ['CHEST', 'WAIST', 'HIPS', 'INSEAM'];

// Measurements that are circumferences on the body. On a garment chart
// measured flat (laid on a table), these are half the circumference.
export const CIRCUMFERENCE_KEYS: readonly MeasurementKey[] = ['CHEST', 'WAIST', 'HIPS'];

// Garment-only dimensions: shown in the size chart table for reference, but
// there's no matching body measurement to compare them against.
export const DISPLAY_ONLY_KEYS: readonly MeasurementKey[] = ['LENGTH', 'SHOULDER', 'SLEEVE'];

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  HEIGHT: 'Height',
  WEIGHT: 'Weight',
  CHEST: 'Chest',
  WAIST: 'Waist',
  HIPS: 'Hips',
  INSEAM: 'Inseam',
  LENGTH: 'Length',
  SHOULDER: 'Shoulder',
  SLEEVE: 'Sleeve',
};

export function measurementUnit(key: MeasurementKey): 'cm' | 'kg' {
  return key === 'WEIGHT' ? 'kg' : 'cm';
}

// How the customer should take each measurement — shown under each field.
export const MEASURING_TIPS: Record<CustomerMeasurementKey, string> = {
  HEIGHT: 'Standing straight, without shoes.',
  WEIGHT: 'Your current weight.',
  CHEST: 'Around the fullest part of your chest, under the arms, tape level.',
  WAIST: 'Around your natural waistline, where you usually wear your trousers.',
  HIPS: 'Around the fullest part of your hips and seat, feet together.',
  INSEAM: 'From the crotch to the floor along the inside of your leg, without shoes.',
};

// What a plausible adult customer measurement looks like. Anything outside
// these is rejected as a typo or a wrong unit rather than compared against
// the chart.
export const CUSTOMER_LIMITS: Record<CustomerMeasurementKey, { min: number; max: number }> = {
  HEIGHT: { min: 120, max: 230 },
  WEIGHT: { min: 30, max: 250 },
  CHEST: { min: 60, max: 180 },
  WAIST: { min: 45, max: 180 },
  HIPS: { min: 60, max: 190 },
  INSEAM: { min: 50, max: 110 },
};

// Admin-entered chart values: a looser sanity bound (garment charts measured
// flat are half a body circumference, so the floor is low).
export const CHART_VALUE_LIMITS: Record<MeasurementKey, { min: number; max: number }> = {
  HEIGHT: { min: 100, max: 230 },
  WEIGHT: { min: 20, max: 250 },
  CHEST: { min: 20, max: 250 },
  WAIST: { min: 15, max: 250 },
  HIPS: { min: 20, max: 250 },
  INSEAM: { min: 20, max: 130 },
  LENGTH: { min: 10, max: 160 },
  SHOULDER: { min: 10, max: 80 },
  SLEEVE: { min: 5, max: 100 },
};

// Ease = how much bigger the garment is than the body it's designed for. It
// can be negative (stretch garments cut smaller than the body, or trousers
// meant to sit above the ankle).
export const EASE_LIMITS = { min: -40, max: 80 };

export type SizeChartBasis = 'BODY' | 'GARMENT';
export type GarmentFit = 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';
export type FabricStretch = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
export type FitPreference = 'SLIM' | 'REGULAR' | 'OVERSIZED';

export const FIT_LABELS: Record<GarmentFit, string> = {
  SLIM: 'Slim',
  REGULAR: 'Regular',
  RELAXED: 'Relaxed',
  OVERSIZED: 'Oversized',
};

export const STRETCH_LABELS: Record<FabricStretch, string> = {
  NONE: 'No stretch',
  LOW: 'Low stretch',
  MODERATE: 'Moderate stretch',
  HIGH: 'High stretch',
};

export type Range = { min: number; max: number };

/**
 * A verified size chart as the storefront sees it — plain JSON, safe to pass
 * from a server component to the client.
 */
export type SizeChartData = {
  id: string;
  name: string;
  basis: SizeChartBasis;
  // GARMENT charts only: chest/waist/hips values were measured flat, i.e.
  // they're half the garment's circumference.
  garmentFlat: boolean;
  fit: GarmentFit | null;
  stretch: FabricStretch | null;
  notes: string | null;
  // Smallest to largest.
  sizes: { size: string; measurements: Partial<Record<MeasurementKey, Range>> }[];
  // GARMENT charts only: the brand's intended ease per measurement.
  ease: Partial<Record<MeasurementKey, Range>>;
};

/** Measurement columns present in a chart, in canonical display order. */
export function chartColumns(chart: Pick<SizeChartData, 'sizes'>): MeasurementKey[] {
  return MEASUREMENT_KEYS.filter((key) => chart.sizes.some((s) => s.measurements[key] !== undefined));
}

/**
 * Size labels are typed by hand in two places (variants and charts), so
 * compare them loosely: case and spacing don't matter, and "2XL" is "XXL".
 */
export function normalizeSizeLabel(size: string): string {
  const compact = size.trim().toUpperCase().replace(/\s+/g, '');
  const numericX = compact.match(/^([2-6])X([SL])$/);
  if (numericX) return 'X'.repeat(Number(numericX[1])) + numericX[2];
  return compact;
}

export function formatRange(range: Range, unit: string): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return range.min === range.max ? `${fmt(range.min)} ${unit}` : `${fmt(range.min)}–${fmt(range.max)} ${unit}`;
}
