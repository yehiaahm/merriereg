// The Find My Size recommendation engine. Pure functions, no I/O: given one
// product's verified size chart, the customer's measurements and the
// product's live variants, it picks the best-supported size that can
// actually be bought.
//
// How it works (deliberately simple, so every result can be explained):
//
// 1. Every chart row is turned into a *body* range per measurement. Body
//    charts already are. Garment charts are converted using the ease the
//    brand entered for that chart (garment − ease = body it's designed for);
//    without that ease a garment measurement is shown but never compared.
// 2. Each size is scored by how far the customer's measurements fall outside
//    its ranges, in units of that chart's own step between sizes (so 1.0 =
//    "one size off"). Being too big for a size (tight) counts more than
//    being too small (loose) unless the chart says the fabric stretches.
//    Height and weight are only preliminary indicators: when a direct body
//    measurement is available they barely move the score.
// 3. If the runner-up is nearly as good, the customer is between sizes; the
//    fit preference (or fabric stretch) picks one and the other becomes the
//    alternative.
// 4. Only active, in-stock variants of the selected color are recommended.
//
// Nothing here guesses at sizing rules the chart doesn't contain — no BMI,
// no weight brackets, no default ease. Missing data lowers confidence or
// stops the recommendation with an explanation.

import {
  CIRCUMFERENCE_KEYS,
  CUSTOMER_MEASUREMENT_KEYS,
  DIRECT_KEYS,
  FIT_LABELS,
  MEASUREMENT_LABELS,
  PRELIMINARY_KEYS,
  formatRange,
  measurementUnit,
  normalizeSizeLabel,
  type CustomerMeasurementKey,
  type FitPreference,
  type Range,
  type SizeChartData,
} from './measurements';

export type CustomerMeasurements = Partial<Record<CustomerMeasurementKey, number>>;

export type SizeFinderInput = {
  measurements: CustomerMeasurements;
  preferredFit: FitPreference | null;
};

export type VariantAvailability = {
  size: string;
  color: string;
  stock: number;
  active: boolean;
};

export type Confidence = 'high' | 'medium' | 'low';

export type RecommendationStatus =
  // A purchasable size is recommended.
  | 'recommended'
  // Height/weight alone can't separate two or more sizes; a body measurement is needed.
  | 'needs_more_measurements'
  // The customer's measurements are beyond the chart's smallest/largest size.
  | 'out_of_range'
  // The best match can't be bought and no other size is a close enough match.
  | 'unavailable'
  // The chart (or the input) doesn't contain enough to compare.
  | 'insufficient_data';

export type MeasurementComparison = {
  key: CustomerMeasurementKey;
  value: number;
  // The body range this size is designed for.
  range: Range;
  // Set when `range` was derived from a garment measurement and ease.
  garment: Range | null;
  ease: Range | null;
  position: 'within' | 'below' | 'above';
  preliminary: boolean;
};

export type SizeRecommendation = {
  status: RecommendationStatus;
  // Always a size that's active and in stock in the selected color (or null).
  recommendedSize: string | null;
  // The chart size that best matches the measurements, regardless of stock.
  idealSize: string | null;
  // Adjacent, purchasable, and nearly as good a match — only when the data supports it.
  alternativeSize: string | null;
  confidence: Confidence | null;
  summary: string;
  reasons: string[];
  warnings: string[];
  // Per-measurement comparison against the recommended (or ideal) size.
  comparisons: MeasurementComparison[];
  // needs_more_measurements: the sizes still in contention.
  candidates: string[];
  // Measurements the chart can use that the customer hasn't given.
  suggestedMeasurements: CustomerMeasurementKey[];
  // unavailable / substituted: colors where the ideal size is in stock.
  otherColorsWithIdealSize: string[];
  basis: {
    measurementsUsed: CustomerMeasurementKey[];
    preliminaryOnly: boolean;
    derivedFromGarment: boolean;
  };
};

// ---- Tuning constants (all in "size steps", see scoreSize) ----

// A runner-up within this many steps of the best size means "between sizes".
const BETWEEN_SIZES_BAND = 0.5;
// Scores closer than this are a genuine tie.
const TIE_EPSILON = 0.05;
// More than one full size beyond the smallest/largest size = no size fits.
const OUT_OF_RANGE_STEPS = 1;
// Weight of height/weight relative to a direct body measurement when both
// are given. Not zero: it still separates otherwise-equal sizes.
const PRELIMINARY_WEIGHT_WITH_DIRECT = 0.1;
// Too-tight counts this much more than too-loose for low/no/unknown stretch.
const TIGHT_PENALTY = 1.5;

type BodyRange = { range: Range; garment: Range | null; ease: Range | null };

type ChartRow = {
  size: string;
  index: number;
  ranges: Partial<Record<CustomerMeasurementKey, BodyRange>>;
};

const isPreliminary = (key: CustomerMeasurementKey) => PRELIMINARY_KEYS.includes(key);

/**
 * Converts a chart into body ranges per size. Garment measurements without
 * ease are left out (they can't be compared to a body), and reported back so
 * the UI can say why.
 */
export function bodyRangesForChart(chart: SizeChartData): {
  rows: ChartRow[];
  comparableKeys: CustomerMeasurementKey[];
  garmentKeysWithoutEase: CustomerMeasurementKey[];
} {
  const garmentKeysWithoutEase = new Set<CustomerMeasurementKey>();
  const rows: ChartRow[] = chart.sizes.map((row, index) => {
    const ranges: ChartRow['ranges'] = {};
    for (const key of CUSTOMER_MEASUREMENT_KEYS) {
      const value = row.measurements[key];
      if (!value) continue;
      // Height and weight on any chart describe the wearer, never the garment.
      if (chart.basis === 'BODY' || isPreliminary(key)) {
        ranges[key] = { range: value, garment: null, ease: null };
        continue;
      }
      const ease = chart.ease[key];
      if (!ease) {
        garmentKeysWithoutEase.add(key);
        continue;
      }
      const factor = chart.garmentFlat && CIRCUMFERENCE_KEYS.includes(key) ? 2 : 1;
      const garment = { min: value.min * factor, max: value.max * factor };
      ranges[key] = {
        range: { min: round1(garment.min - ease.max), max: round1(garment.max - ease.min) },
        garment,
        ease,
      };
    }
    return { size: row.size, index, ranges };
  });

  const comparableKeys = CUSTOMER_MEASUREMENT_KEYS.filter((key) => rows.some((r) => r.ranges[key]));
  return { rows, comparableKeys, garmentKeysWithoutEase: [...garmentKeysWithoutEase] };
}

/**
 * Which measurements the form should ask for, given a chart. Only what the
 * chart can actually use is ever collected.
 *
 * - If the chart lists height/weight, those are required (they're quick to
 *   give) and the direct body measurements are optional extras.
 * - Otherwise the first direct measurement the chart has is required.
 */
export function inputFieldsForChart(chart: SizeChartData): {
  required: CustomerMeasurementKey[];
  optional: CustomerMeasurementKey[];
} {
  const { comparableKeys } = bodyRangesForChart(chart);
  const preliminary = comparableKeys.filter(isPreliminary);
  const direct = DIRECT_KEYS.filter((k) => comparableKeys.includes(k));
  if (preliminary.length > 0) return { required: preliminary, optional: direct };
  if (direct.length > 0) return { required: [direct[0]], optional: direct.slice(1) };
  return { required: [], optional: [] };
}

/** The chart's typical difference between consecutive sizes, per measurement. */
function sizeSteps(rows: ChartRow[], keys: CustomerMeasurementKey[]): Record<string, number> {
  const steps: Record<string, number> = {};
  for (const key of keys) {
    const ranges = rows.map((r) => r.ranges[key]?.range).filter((r): r is Range => !!r);
    const mids = ranges.map((r) => (r.min + r.max) / 2);
    const diffs = mids
      .slice(1)
      .map((m, i) => m - mids[i])
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    if (diffs.length > 0) {
      steps[key] = diffs[Math.floor((diffs.length - 1) / 2)];
    } else {
      // Single-size chart (or identical rows): fall back to the range width.
      const width = Math.max(0, ...ranges.map((r) => r.max - r.min));
      steps[key] = width > 0 ? width : 1;
    }
  }
  return steps;
}

type ScoredSize = {
  row: ChartRow;
  score: number;
  comparisons: MeasurementComparison[];
  // Largest normalized deviation among the keys that drive the result.
  maxDeviation: number;
};

function compare(key: CustomerMeasurementKey, value: number, body: BodyRange): MeasurementComparison {
  const { range } = body;
  const position = value < range.min ? 'below' : value > range.max ? 'above' : 'within';
  return { key, value, range, garment: body.garment, ease: body.ease, position, preliminary: isPreliminary(key) };
}

function deviation(c: MeasurementComparison): number {
  if (c.position === 'within') return 0;
  return c.position === 'below' ? c.range.min - c.value : c.value - c.range.max;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function describe(key: CustomerMeasurementKey, value: number) {
  return `${MEASUREMENT_LABELS[key].toLowerCase()} (${fmt(value)} ${measurementUnit(key)})`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listSizes(sizes: string[]) {
  if (sizes.length <= 1) return sizes.join('');
  return `${sizes.slice(0, -1).join(', ')} or ${sizes[sizes.length - 1]}`;
}

/** One plain-language line explaining how a measurement compares with a size. */
export function explainComparison(c: MeasurementComparison, size: string): string {
  const unit = measurementUnit(c.key);
  const what = capitalize(describe(c.key, c.value));
  if (c.garment && c.ease) {
    const room = formatRange(c.ease, unit);
    const garment = formatRange(c.garment, unit);
    const fits = `${formatRange(c.range, unit)}`;
    if (c.position === 'within') {
      return `${what} suits ${size}: the garment measures ${garment} and is designed with ${room} of room, which fits ${fits}.`;
    }
    const off = fmt(round1(deviation(c)));
    return `${what} is ${off} ${unit} ${c.position} what ${size} is designed for (${fits}, from a garment measurement of ${garment}).`;
  }
  const label = c.preliminary ? `${size}'s recommended range` : `${size}'s range`;
  if (c.position === 'within') return `${what} is within ${label} (${formatRange(c.range, unit)}).`;
  const off = fmt(round1(deviation(c)));
  return `${what} is ${off} ${unit} ${c.position} ${label} (${formatRange(c.range, unit)}).`;
}

function emptyResult(status: RecommendationStatus, summary: string): SizeRecommendation {
  return {
    status,
    recommendedSize: null,
    idealSize: null,
    alternativeSize: null,
    confidence: null,
    summary,
    reasons: [],
    warnings: [],
    comparisons: [],
    candidates: [],
    suggestedMeasurements: [],
    otherColorsWithIdealSize: [],
    basis: { measurementsUsed: [], preliminaryOnly: false, derivedFromGarment: false },
  };
}

/**
 * For each key, the sizes that match it best on its own. Used to spot
 * measurements pointing at different sizes.
 */
function bestSizesPerKey(scored: ScoredSize[], keys: CustomerMeasurementKey[]) {
  const result = new Map<CustomerMeasurementKey, ScoredSize[]>();
  for (const key of keys) {
    let best = Infinity;
    let bestRows: ScoredSize[] = [];
    for (const s of scored) {
      const c = s.comparisons.find((x) => x.key === key);
      if (!c) continue;
      const d = deviation(c);
      if (d < best - 1e-9) {
        best = d;
        bestRows = [s];
      } else if (Math.abs(d - best) <= 1e-9) {
        bestRows.push(s);
      }
    }
    result.set(key, bestRows);
  }
  return result;
}

export function recommendSize(
  chart: SizeChartData,
  input: SizeFinderInput,
  variants: VariantAvailability[],
  selectedColor: string
): SizeRecommendation {
  const { rows, comparableKeys, garmentKeysWithoutEase } = bodyRangesForChart(chart);

  if (comparableKeys.length === 0) {
    const result = emptyResult(
      'insufficient_data',
      "This product's size chart doesn't include any measurements we can compare yours against, so we can't recommend a size."
    );
    if (garmentKeysWithoutEase.length > 0) {
      result.warnings.push(
        'The chart lists garment measurements, but not how much room the garment is designed to have, so body measurements can\'t be converted reliably. Please use the size chart table instead.'
      );
    }
    return result;
  }

  const provided = comparableKeys.filter((key) => {
    const v = input.measurements[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0;
  });
  if (provided.length === 0) {
    const result = emptyResult('insufficient_data', 'Enter your measurements to get a recommendation.');
    result.suggestedMeasurements = comparableKeys;
    return result;
  }

  const directProvided = provided.filter((k) => !isPreliminary(k));
  const preliminaryOnly = directProvided.length === 0;
  const drivingKeys = preliminaryOnly ? provided : directProvided;
  const steps = sizeSteps(rows, provided);
  const stretchy = chart.stretch === 'MODERATE' || chart.stretch === 'HIGH';
  const tightFactor = stretchy ? 1 : TIGHT_PENALTY;
  const warnings: string[] = [];

  // ---- 1. Score every size that has data for everything the customer gave ----
  const scored: ScoredSize[] = [];
  const incomplete: string[] = [];
  for (const row of rows) {
    if (provided.some((key) => !row.ranges[key])) {
      incomplete.push(row.size);
      continue;
    }
    let weighted = 0;
    let maxDeviation = 0;
    const comparisons = provided.map((key) => compare(key, input.measurements[key]!, row.ranges[key]!));
    for (const c of comparisons) {
      const normalized = deviation(c) / steps[c.key];
      if (c.preliminary && !preliminaryOnly) {
        // Height/weight only nudge the score: capped, never penalised extra
        // for being tight, and small next to any body measurement.
        weighted += PRELIMINARY_WEIGHT_WITH_DIRECT * Math.min(normalized, 1);
        continue;
      }
      weighted += normalized * (c.position === 'above' ? tightFactor : 1);
      maxDeviation = Math.max(maxDeviation, normalized);
    }
    // Averaged over the driving measurements only, so extra height/weight
    // terms can't dilute a direct measurement's deviation.
    scored.push({ row, score: weighted / drivingKeys.length, comparisons, maxDeviation });
  }

  if (incomplete.length > 0) {
    const missing = provided.filter((key) => rows.some((r) => incomplete.includes(r.size) && !r.ranges[key]));
    warnings.push(
      `The size chart has no ${missing.map((k) => MEASUREMENT_LABELS[k].toLowerCase()).join(' or ')} data for ${listSizes(incomplete)}, so ${incomplete.length === 1 ? 'that size wasn\'t' : 'those sizes weren\'t'} considered.`
    );
  }

  if (scored.length === 0) {
    const result = emptyResult(
      'insufficient_data',
      "This product's size chart is incomplete for the measurements you gave, so we can't recommend a size."
    );
    result.warnings = warnings;
    return result;
  }

  // ---- 2. Beyond the smallest / largest size? ----
  const first = scored[0];
  const last = scored[scored.length - 1];
  for (const key of drivingKeys) {
    const value = input.measurements[key]!;
    const lowest = first.row.ranges[key]!.range;
    const highest = last.row.ranges[key]!.range;
    const unit = measurementUnit(key);
    if (value > highest.max + OUT_OF_RANGE_STEPS * steps[key]) {
      const result = emptyResult('out_of_range', "Your measurements are outside this product's size range.");
      result.reasons.push(
        `${capitalize(describe(key, value))} is above the largest size in this chart (${last.row.size}: ${formatRange(highest, unit)}).`
      );
      result.warnings = warnings;
      return withBasis(result, provided, preliminaryOnly, scored);
    }
    if (value < lowest.min - OUT_OF_RANGE_STEPS * steps[key]) {
      const result = emptyResult('out_of_range', "Your measurements are outside this product's size range.");
      result.reasons.push(
        `${capitalize(describe(key, value))} is below the smallest size in this chart (${first.row.size}: ${formatRange(lowest, unit)}).`
      );
      result.warnings = warnings;
      return withBasis(result, provided, preliminaryOnly, scored);
    }
  }

  // ---- 3. Best size, and are we between two sizes? ----
  const best = scored.reduce((a, b) => (b.score < a.score - 1e-9 ? b : a));
  // Only the sizes directly either side of the best one in the chart can be
  // "between sizes" partners — never a size two steps away.
  const runnerUp = scored
    .filter((s) => Math.abs(s.row.index - best.row.index) === 1)
    .sort((a, b) => a.score - b.score)[0];
  const between = !!runnerUp && runnerUp.score - best.score < BETWEEN_SIZES_BAND;

  const reasons: string[] = [];
  let ideal = best;
  let other: ScoredSize | null = null;
  if (between) {
    const [smaller, larger] = runnerUp.row.index < best.row.index ? [runnerUp, best] : [best, runnerUp];
    let pick: ScoredSize;
    let why: string;
    if (input.preferredFit === 'OVERSIZED') {
      pick = larger;
      why = 'You prefer a roomier fit, so we suggest the larger size.';
    } else if (input.preferredFit === 'SLIM') {
      pick = smaller;
      why = 'You prefer a closer fit, so we suggest the smaller size.';
    } else if (Math.abs(runnerUp.score - best.score) > TIE_EPSILON) {
      pick = best;
      why = `Your measurements are a little closer to ${best.row.size}.`;
    } else if (stretchy) {
      pick = smaller;
      why = 'This fabric has some stretch, so the smaller size should still be comfortable.';
    } else {
      pick = larger;
      why =
        chart.stretch === null
          ? "We don't have stretch information for this fabric, so we suggest the larger size to avoid a tight fit."
          : 'This fabric has little or no stretch, so we suggest the larger size to avoid a tight fit.';
    }
    ideal = pick;
    other = pick === smaller ? larger : smaller;
    reasons.push(`You're between ${smaller.row.size} and ${larger.row.size}. ${why}`);
  }

  // ---- 4. Do the measurements disagree with each other? ----
  const perKey = bestSizesPerKey(scored, drivingKeys);
  let conflict = false;
  if (drivingKeys.length > 1) {
    const sets = drivingKeys.map((k) => new Set(perKey.get(k)!.map((s) => s.row.index)));
    conflict = ![...sets[0]].some((i) => sets.every((set) => set.has(i)));
  }

  // ---- 5. Height & weight alone can't separate sizes → ask for more ----
  const directKeysInChart = DIRECT_KEYS.filter((k) => comparableKeys.includes(k));
  const missingDirect = directKeysInChart.filter((k) => !provided.includes(k));
  if (preliminaryOnly && (between || conflict) && missingDirect.length > 0) {
    const candidateRows = new Set<ScoredSize>([best]);
    if (between) candidateRows.add(runnerUp);
    if (conflict) for (const k of drivingKeys) for (const s of perKey.get(k)!) candidateRows.add(s);
    const candidates = [...candidateRows].sort((a, b) => a.row.index - b.row.index).map((s) => s.row.size);
    const result = emptyResult(
      'needs_more_measurements',
      `Your height and weight fit ${listSizes(candidates)} on this product's chart, so they can't tell those sizes apart.`
    );
    result.candidates = candidates;
    result.suggestedMeasurements = missingDirect;
    result.reasons.push(
      `Add your ${missingDirect.map((k) => MEASUREMENT_LABELS[k].toLowerCase()).join(' or ')} measurement and we'll compare it with the chart directly.`
    );
    if (conflict) {
      result.reasons.push(
        drivingKeys.map((k) => `your ${MEASUREMENT_LABELS[k].toLowerCase()} matches ${listSizes(perKey.get(k)!.map((s) => s.row.size))}`).join(', but ').replace(/^./, (c) => c.toUpperCase()) + '.'
      );
    }
    result.warnings = warnings;
    return withBasis(result, provided, preliminaryOnly, scored);
  }

  // ---- 6. Map to what can actually be bought ----
  const sameColor = variants.filter((v) => v.color === selectedColor);
  const purchasable = new Map(
    sameColor.filter((v) => v.active && v.stock > 0).map((v) => [normalizeSizeLabel(v.size), v.size])
  );
  const offered = new Map(sameColor.map((v) => [normalizeSizeLabel(v.size), v]));
  const idealKey = normalizeSizeLabel(ideal.row.size);

  let chosen: ScoredSize | null = ideal;
  let alternative: ScoredSize | null = other;
  let substituted = false;
  const otherColorsWithIdealSize = [
    ...new Set(
      variants
        .filter((v) => v.color !== selectedColor && v.active && v.stock > 0 && normalizeSizeLabel(v.size) === idealKey)
        .map((v) => v.color)
    ),
  ];

  if (!purchasable.has(idealKey)) {
    const offeredVariant = offered.get(idealKey);
    const why = !offeredVariant
      ? `isn't made in ${ideal.row.size}`
      : !offeredVariant.active
        ? `${ideal.row.size} is currently unavailable in ${selectedColor}`
        : `${ideal.row.size} is out of stock in ${selectedColor}`;
    if (other && purchasable.has(normalizeSizeLabel(other.row.size))) {
      chosen = other;
      alternative = null;
      substituted = true;
      warnings.push(
        `Your best match is ${ideal.row.size}, but ${offeredVariant ? why : `this product ${why}`}. ${other.row.size} is the next-closest match for your measurements.`
      );
    } else {
      const result = emptyResult(
        'unavailable',
        offeredVariant
          ? `Your best match is ${ideal.row.size}, but ${why}.`
          : `Your best match is ${ideal.row.size}, but this product ${why}.`
      );
      result.idealSize = ideal.row.size;
      result.comparisons = ideal.comparisons;
      result.otherColorsWithIdealSize = otherColorsWithIdealSize;
      result.reasons = [...reasons, ...ideal.comparisons.filter((c) => !c.preliminary || preliminaryOnly).map((c) => explainComparison(c, ideal.row.size))];
      result.warnings = [
        ...warnings,
        "None of the sizes that are in stock is a close enough match for us to recommend it instead.",
      ];
      return withBasis(result, provided, preliminaryOnly, scored);
    }
  }
  if (alternative && !purchasable.has(normalizeSizeLabel(alternative.row.size))) alternative = null;

  // ---- 7. Confidence ----
  const derivedFromGarment = chosen.comparisons.some((c) => c.garment !== null);
  let level = preliminaryOnly ? 2 : 3;
  if (!preliminaryOnly && chosen.comparisons.filter((c) => !c.preliminary).every((c) => c.garment !== null)) level--;
  if (between) level--;
  if (conflict) level--;
  if (!between && chosen.comparisons.some((c) => drivingKeys.includes(c.key) && c.position !== 'within')) level--;
  if (substituted) level--;
  const confidence: Confidence = level >= 3 ? 'high' : level === 2 ? 'medium' : 'low';

  // ---- 8. Explanation ----
  const size = chosen.row.size;
  for (const c of chosen.comparisons) {
    if (c.preliminary && !preliminaryOnly) continue;
    reasons.push(explainComparison(c, size));
  }
  if (conflict) {
    reasons.push(
      `Your measurements point to different sizes (${drivingKeys
        .map((k) => `${MEASUREMENT_LABELS[k].toLowerCase()}: ${listSizes(perKey.get(k)!.map((s) => s.row.size))}`)
        .join('; ')}), so we chose the size that fits best overall.`
    );
  }
  if (!preliminaryOnly) {
    for (const c of chosen.comparisons) {
      if (c.preliminary && c.position !== 'within') {
        warnings.push(
          `Your ${MEASUREMENT_LABELS[c.key].toLowerCase()} (${fmt(c.value)} ${measurementUnit(c.key)}) is ${c.position} the range this chart lists for ${size} (${formatRange(c.range, measurementUnit(c.key))}).`
        );
      }
    }
  }
  if (preliminaryOnly) {
    warnings.push(
      missingDirect.length > 0
        ? `This is a preliminary estimate based on height and weight only. Adding your ${missingDirect.map((k) => MEASUREMENT_LABELS[k].toLowerCase()).join(' or ')} will make it more reliable.`
        : "This product's chart only lists height and weight ranges, so this is a preliminary estimate — body shape can change which size fits best."
    );
  }
  if (!between && chosen.comparisons.some((c) => drivingKeys.includes(c.key) && c.position !== 'within')) {
    const isEdge = chosen === first || chosen === last;
    warnings.push(
      isEdge
        ? `Your measurements are slightly ${chosen === last ? 'above the largest' : 'below the smallest'} size in this chart, so ${size} may fit ${chosen === last ? 'snugly' : 'loosely'}.`
        : `Your measurements don't fall exactly within ${size}'s range, but it's the closest match.`
    );
  }
  if (chart.fit) {
    const cut = FIT_LABELS[chart.fit].toLowerCase();
    if (chart.fit === 'OVERSIZED' || chart.fit === 'RELAXED') {
      reasons.push(`This product is cut with a ${cut} fit, and its chart already accounts for that — so your measured size gives the intended look.`);
      if (input.preferredFit === 'SLIM') {
        warnings.push(`This product is designed with a ${cut} cut, so it will fit loosely even in your recommended size.`);
      }
    } else if (chart.fit === 'SLIM' && input.preferredFit === 'OVERSIZED') {
      warnings.push("This product is designed with a slim cut — it isn't intended to be worn oversized.");
    }
  }
  if (garmentKeysWithoutEase.length > 0) {
    warnings.push(
      `The chart's garment ${garmentKeysWithoutEase.map((k) => MEASUREMENT_LABELS[k].toLowerCase()).join(' and ')} measurement${garmentKeysWithoutEase.length > 1 ? 's' : ''} couldn't be compared with your body because the intended ease isn't specified.`
    );
  }

  const alternativeSize = alternative ? purchasable.get(normalizeSizeLabel(alternative.row.size))! : null;
  const recommendedSize = purchasable.get(normalizeSizeLabel(size))!;
  return {
    status: 'recommended',
    recommendedSize,
    idealSize: ideal.row.size,
    alternativeSize,
    confidence,
    summary: alternativeSize
      ? `${recommendedSize} is the best match for your measurements, with ${alternativeSize} as a close alternative.`
      : `${recommendedSize} is the best match for your measurements.`,
    reasons,
    warnings,
    comparisons: chosen.comparisons,
    candidates: [],
    suggestedMeasurements: missingDirect,
    otherColorsWithIdealSize: substituted ? otherColorsWithIdealSize : [],
    basis: { measurementsUsed: provided, preliminaryOnly, derivedFromGarment },
  };
}

function withBasis(
  result: SizeRecommendation,
  provided: CustomerMeasurementKey[],
  preliminaryOnly: boolean,
  scored: ScoredSize[]
): SizeRecommendation {
  result.basis = {
    measurementsUsed: provided,
    preliminaryOnly,
    derivedFromGarment: scored.some((s) => s.comparisons.some((c) => c.garment !== null)),
  };
  return result;
}
