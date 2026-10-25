// Unit tests for the Find My Size engine (lib/sizing/engine.ts).
// Run: npm run test:sizing
//
// Every chart below is synthetic TEST DATA built to exercise edge cases —
// none of it describes a real MERRIER product.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  recommendSize,
  inputFieldsForChart,
  bodyRangesForChart,
  type VariantAvailability,
  type SizeFinderInput,
} from '../../lib/sizing/engine';
import type { SizeChartData } from '../../lib/sizing/measurements';

// Body chart with deliberate 3 cm gaps between chest ranges and overlapping
// height/weight ranges (as real height/weight charts usually have).
const BODY_TEE: SizeChartData = {
  id: 'test-body-tee',
  name: 'TEST body chart',
  basis: 'BODY',
  garmentFlat: false,
  fit: 'REGULAR',
  stretch: null,
  notes: null,
  ease: {},
  sizes: [
    { size: 'S', measurements: { CHEST: { min: 88, max: 93 }, WAIST: { min: 72, max: 77 }, HEIGHT: { min: 160, max: 172 }, WEIGHT: { min: 50, max: 64 } } },
    { size: 'M', measurements: { CHEST: { min: 96, max: 101 }, WAIST: { min: 80, max: 85 }, HEIGHT: { min: 168, max: 180 }, WEIGHT: { min: 60, max: 75 } } },
    { size: 'L', measurements: { CHEST: { min: 104, max: 109 }, WAIST: { min: 88, max: 93 }, HEIGHT: { min: 175, max: 188 }, WEIGHT: { min: 72, max: 88 } } },
    { size: 'XL', measurements: { CHEST: { min: 112, max: 117 }, WAIST: { min: 96, max: 101 }, HEIGHT: { min: 182, max: 195 }, WEIGHT: { min: 85, max: 100 } } },
  ],
};

// Garment chart measured flat, with the brand's intended chest ease.
// Chest circumference 100/106/112/118 cm, ease 14–20 cm → bodies of
// 80–86 / 86–92 / 92–98 / 98–104 cm.
const GARMENT_OVERSIZED: SizeChartData = {
  id: 'test-garment-tee',
  name: 'TEST garment chart',
  basis: 'GARMENT',
  garmentFlat: true,
  fit: 'OVERSIZED',
  stretch: 'LOW',
  notes: null,
  ease: { CHEST: { min: 14, max: 20 } },
  sizes: [
    { size: 'S', measurements: { CHEST: { min: 50, max: 50 }, LENGTH: { min: 68, max: 68 } } },
    { size: 'M', measurements: { CHEST: { min: 53, max: 53 }, LENGTH: { min: 70, max: 70 } } },
    { size: 'L', measurements: { CHEST: { min: 56, max: 56 }, LENGTH: { min: 72, max: 72 } } },
    { size: 'XL', measurements: { CHEST: { min: 59, max: 59 }, LENGTH: { min: 74, max: 74 } } },
  ],
};

function stock(sizes: Record<string, number>, color = 'Black'): VariantAvailability[] {
  return Object.entries(sizes).map(([size, s]) => ({ size, color, stock: s, active: true }));
}

const ALL_IN_STOCK = stock({ S: 5, M: 5, L: 5, XL: 5 });

function input(measurements: SizeFinderInput['measurements'], preferredFit: SizeFinderInput['preferredFit'] = null): SizeFinderInput {
  return { measurements, preferredFit };
}

describe('clear matches', () => {
  test('chest in the middle of M recommends M with high confidence', () => {
    const r = recommendSize(BODY_TEE, input({ HEIGHT: 175, WEIGHT: 70, CHEST: 98.5 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    assert.equal(r.recommendedSize, 'M');
    assert.equal(r.alternativeSize, null);
    assert.equal(r.confidence, 'high');
    assert.ok(r.reasons.some((x) => x.includes('within M')));
    assert.deepEqual(r.basis.measurementsUsed, ['HEIGHT', 'WEIGHT', 'CHEST']);
    assert.equal(r.basis.preliminaryOnly, false);
  });

  test('every recommendation is explained and never claims certainty', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 98.5 }), ALL_IN_STOCK, 'Black');
    assert.ok(r.reasons.length > 0);
    const text = [r.summary, ...r.reasons, ...r.warnings].join(' ').toLowerCase();
    assert.ok(!/100%|guarantee|perfect fit|certain/.test(text));
  });

  test('height and weight barely move the result when a body measurement is given', () => {
    // Chest says M clearly; height/weight say XL.
    const r = recommendSize(BODY_TEE, input({ HEIGHT: 190, WEIGHT: 95, CHEST: 98.5 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'M');
    assert.ok(r.warnings.some((w) => w.includes('height') && w.includes('above')));
  });
});

describe('between two sizes', () => {
  test('in the gap between M and L with no preference: closest wins, other is the alternative', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 102.5 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    // Unknown stretch → being tight in M is penalised more than loose in L.
    assert.equal(r.recommendedSize, 'L');
    assert.equal(r.alternativeSize, 'M');
    assert.equal(r.confidence, 'medium');
    assert.ok(r.reasons.some((x) => x.includes("between M and L")));
  });

  test('slim preference picks the smaller size', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 102.5 }, 'SLIM'), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'M');
    assert.equal(r.alternativeSize, 'L');
  });

  test('oversized preference picks the larger size', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 102.5 }, 'OVERSIZED'), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'L');
    assert.equal(r.alternativeSize, 'M');
  });

  test('exact tie with stretchy fabric picks the smaller size', () => {
    const stretchy: SizeChartData = { ...BODY_TEE, stretch: 'HIGH' };
    const r = recommendSize(stretchy, input({ CHEST: 102.5 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'M');
    assert.ok(r.reasons.some((x) => x.includes('stretch')));
  });

  test('exact tie with no-stretch fabric picks the larger size', () => {
    const rigid: SizeChartData = { ...BODY_TEE, stretch: 'NONE' };
    // With a tight penalty, the exact midpoint is no longer a tie — use a
    // point where the weighted scores are equal: 1.5·(x−101) = 104−x → x = 102.2
    const r = recommendSize(rigid, input({ CHEST: 102.2 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'L');
  });

  test('top edge of a range counts as between sizes', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 101 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'M');
    assert.equal(r.alternativeSize, 'L');
    assert.equal(r.confidence, 'medium');
  });

  test('a size two steps away is never offered as the alternative', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 98.5 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.alternativeSize, null);
  });
});

describe('height and weight only', () => {
  test('unambiguous height and weight give a preliminary, medium-confidence result', () => {
    const r = recommendSize(BODY_TEE, input({ HEIGHT: 162, WEIGHT: 52 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    assert.equal(r.recommendedSize, 'S');
    assert.equal(r.confidence, 'medium');
    assert.equal(r.basis.preliminaryOnly, true);
    assert.ok(r.warnings.some((w) => w.includes('preliminary')));
  });

  test('overlapping height/weight ranges ask for a body measurement instead of guessing', () => {
    const r = recommendSize(BODY_TEE, input({ HEIGHT: 176, WEIGHT: 73 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'needs_more_measurements');
    assert.equal(r.recommendedSize, null);
    assert.deepEqual(r.candidates, ['M', 'L']);
    assert.deepEqual(r.suggestedMeasurements, ['CHEST', 'WAIST']);
  });

  test('height and weight pointing at different sizes ask for more measurements', () => {
    const r = recommendSize(BODY_TEE, input({ HEIGHT: 192, WEIGHT: 55 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'needs_more_measurements');
    assert.ok(r.candidates.includes('S'));
    assert.ok(r.candidates.includes('XL'));
  });

  test('adding chest resolves the ambiguity', () => {
    const r = recommendSize(BODY_TEE, input({ HEIGHT: 176, WEIGHT: 73, CHEST: 106 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    assert.equal(r.recommendedSize, 'L');
  });

  test('a height/weight-only chart can still answer, but only with low confidence when ambiguous', () => {
    const hwOnly: SizeChartData = {
      ...BODY_TEE,
      sizes: BODY_TEE.sizes.map((s) => ({ size: s.size, measurements: { HEIGHT: s.measurements.HEIGHT, WEIGHT: s.measurements.WEIGHT } })),
    };
    const r = recommendSize(hwOnly, input({ HEIGHT: 176, WEIGHT: 73 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    assert.equal(r.confidence, 'low');
    assert.ok(r.alternativeSize);
  });
});

describe('conflicting measurements', () => {
  test('chest and waist pointing at different sizes lowers confidence and says so', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 98.5, WAIST: 90.5 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    assert.ok(['M', 'L'].includes(r.recommendedSize!));
    assert.notEqual(r.confidence, 'high');
    assert.ok(r.reasons.some((x) => x.includes('point to different sizes')));
  });
});

describe('outside the chart', () => {
  test('far above the largest size refuses to recommend', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 130 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'out_of_range');
    assert.equal(r.recommendedSize, null);
    assert.ok(r.reasons[0].includes('above the largest size'));
  });

  test('far below the smallest size refuses to recommend', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 70 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'out_of_range');
    assert.ok(r.reasons[0].includes('below the smallest size'));
  });

  test('slightly above the largest size recommends it with a warning', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 120 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'recommended');
    assert.equal(r.recommendedSize, 'XL');
    assert.equal(r.confidence, 'medium');
    assert.ok(r.warnings.some((w) => w.includes('slightly above the largest')));
  });
});

describe('availability', () => {
  test('never recommends an out-of-stock size; refuses when no neighbour is close enough', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 98.5 }), stock({ S: 5, M: 0, L: 5, XL: 5 }), 'Black');
    assert.equal(r.status, 'unavailable');
    assert.equal(r.recommendedSize, null);
    assert.equal(r.idealSize, 'M');
    assert.ok(r.summary.includes('out of stock in Black'));
  });

  test('suggests the in-stock neighbour when the customer is between sizes', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 102.5 }), stock({ S: 5, M: 5, L: 0, XL: 5 }), 'Black');
    assert.equal(r.status, 'recommended');
    assert.equal(r.idealSize, 'L');
    assert.equal(r.recommendedSize, 'M');
    assert.equal(r.alternativeSize, null);
    assert.equal(r.confidence, 'low');
    assert.ok(r.warnings.some((w) => w.includes('Your best match is L')));
  });

  test('inactive variants are treated as unavailable', () => {
    const variants = ALL_IN_STOCK.map((v) => (v.size === 'M' ? { ...v, active: false } : v));
    const r = recommendSize(BODY_TEE, input({ CHEST: 98.5 }), variants, 'Black');
    assert.equal(r.status, 'unavailable');
    assert.ok(r.summary.includes('currently unavailable'));
  });

  test('only the selected color counts, and other colors with the size are listed', () => {
    const variants = [...stock({ S: 5, M: 0, L: 5 }, 'Black'), ...stock({ S: 5, M: 3, L: 5 }, 'White')];
    const black = recommendSize(BODY_TEE, input({ CHEST: 98.5 }), variants, 'Black');
    assert.equal(black.status, 'unavailable');
    assert.deepEqual(black.otherColorsWithIdealSize, ['White']);
    const white = recommendSize(BODY_TEE, input({ CHEST: 98.5 }), variants, 'White');
    assert.equal(white.recommendedSize, 'M');
  });

  test('a size the product is not made in is reported as such', () => {
    const r = recommendSize(BODY_TEE, input({ CHEST: 114 }), stock({ S: 5, M: 5, L: 5 }), 'Black');
    assert.equal(r.status, 'unavailable');
    assert.ok(r.summary.includes("isn't made in XL"));
  });

  test('chart and variant size labels are matched loosely (2XL = XXL)', () => {
    const chart: SizeChartData = { ...BODY_TEE, sizes: BODY_TEE.sizes.map((s) => (s.size === 'XL' ? { ...s, size: '2XL' } : s)) };
    const r = recommendSize(chart, input({ CHEST: 114 }), stock({ S: 5, M: 5, L: 5, ' xxl ': 5 }), 'Black');
    assert.equal(r.status, 'recommended');
    // Returns the variant's own label so it can be applied to the selector.
    assert.equal(r.recommendedSize, ' xxl ');
  });
});

describe('garment charts', () => {
  test('flat garment measurements are converted to body ranges using the stated ease', () => {
    const { rows } = bodyRangesForChart(GARMENT_OVERSIZED);
    assert.deepEqual(rows[1].ranges.CHEST?.range, { min: 86, max: 92 });
    assert.deepEqual(rows[1].ranges.CHEST?.garment, { min: 106, max: 106 });
  });

  test('a garment-derived match is explained and capped below high confidence', () => {
    const r = recommendSize(GARMENT_OVERSIZED, input({ CHEST: 89 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'M');
    assert.equal(r.confidence, 'medium');
    assert.equal(r.basis.derivedFromGarment, true);
    assert.ok(r.reasons.some((x) => x.includes('garment measures 106 cm')));
    assert.ok(r.reasons.some((x) => x.includes('oversized fit')));
  });

  test('slim preference on an oversized product warns it will still fit loosely', () => {
    const r = recommendSize(GARMENT_OVERSIZED, input({ CHEST: 89 }, 'SLIM'), ALL_IN_STOCK, 'Black');
    assert.ok(r.warnings.some((w) => w.includes('fit loosely')));
  });

  test('garment measurements without ease are never compared', () => {
    const noEase: SizeChartData = { ...GARMENT_OVERSIZED, ease: {} };
    const r = recommendSize(noEase, input({ CHEST: 89 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'insufficient_data');
    assert.ok(r.warnings.some((w) => w.includes("can't be converted reliably")));
    assert.deepEqual(inputFieldsForChart(noEase), { required: [], optional: [] });
  });

  test('garment chart without ease but with height/weight uses those and flags the rest', () => {
    const chart: SizeChartData = {
      ...GARMENT_OVERSIZED,
      ease: {},
      sizes: GARMENT_OVERSIZED.sizes.map((s, i) => ({
        ...s,
        measurements: { ...s.measurements, HEIGHT: BODY_TEE.sizes[i].measurements.HEIGHT, WEIGHT: BODY_TEE.sizes[i].measurements.WEIGHT },
      })),
    };
    const r = recommendSize(chart, input({ HEIGHT: 165, WEIGHT: 57 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'S');
    assert.ok(r.warnings.some((w) => w.includes('intended ease')));
  });
});

describe('missing or incomplete charts', () => {
  test('a chart with only display measurements cannot recommend', () => {
    const lengthOnly: SizeChartData = {
      ...GARMENT_OVERSIZED,
      sizes: GARMENT_OVERSIZED.sizes.map((s) => ({ size: s.size, measurements: { LENGTH: s.measurements.LENGTH } })),
    };
    const r = recommendSize(lengthOnly, input({ CHEST: 89 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'insufficient_data');
  });

  test('sizes missing a measurement are skipped and reported', () => {
    const incomplete: SizeChartData = {
      ...BODY_TEE,
      sizes: BODY_TEE.sizes.map((s) => (s.size === 'XL' ? { size: 'XL', measurements: { HEIGHT: s.measurements.HEIGHT } } : s)),
    };
    const r = recommendSize(incomplete, input({ CHEST: 106 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'L');
    assert.ok(r.warnings.some((w) => w.includes('no chest data for XL')));
  });

  test('no measurements entered asks for them', () => {
    const r = recommendSize(BODY_TEE, input({}), ALL_IN_STOCK, 'Black');
    assert.equal(r.status, 'insufficient_data');
    assert.equal(r.recommendedSize, null);
  });

  test('ignores measurements the chart does not use', () => {
    const r = recommendSize(GARMENT_OVERSIZED, input({ CHEST: 89, HIPS: 150, WEIGHT: 200 }), ALL_IN_STOCK, 'Black');
    assert.equal(r.recommendedSize, 'M');
    assert.deepEqual(r.basis.measurementsUsed, ['CHEST']);
  });
});

describe('different products, same customer', () => {
  test('the same measurements give each product its own chart-based answer', () => {
    const measurements = { CHEST: 89 };
    const body = recommendSize(BODY_TEE, input(measurements), ALL_IN_STOCK, 'Black');
    const garment = recommendSize(GARMENT_OVERSIZED, input(measurements), ALL_IN_STOCK, 'Black');
    assert.equal(body.recommendedSize, 'S');
    assert.equal(garment.recommendedSize, 'M');
  });
});

describe('form fields per chart', () => {
  test('charts with height/weight require them and offer body measurements as optional', () => {
    assert.deepEqual(inputFieldsForChart(BODY_TEE), { required: ['HEIGHT', 'WEIGHT'], optional: ['CHEST', 'WAIST'] });
  });

  test('charts without height/weight require their first body measurement only', () => {
    const pants: SizeChartData = {
      ...BODY_TEE,
      sizes: [
        { size: 'S', measurements: { WAIST: { min: 70, max: 76 }, HIPS: { min: 88, max: 94 } } },
        { size: 'M', measurements: { WAIST: { min: 76, max: 82 }, HIPS: { min: 94, max: 100 } } },
      ],
    };
    assert.deepEqual(inputFieldsForChart(pants), { required: ['WAIST'], optional: ['HIPS'] });
  });
});
