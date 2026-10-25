// Every chart in scripts/size-chart-data.mjs must pass the same validation the
// admin API applies, and behave sensibly in the engine.
// Run: npm run test:sizing
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain .mjs data module without types
import { SIZE_CHARTS } from '../../scripts/size-chart-data.mjs';
import { sizeChartInputSchema, parseStoredChart } from '../../lib/sizing/chart-schema';
import { recommendSize, inputFieldsForChart } from '../../lib/sizing/engine';

type Entry = { name: string; categorySlugs: string[]; [k: string]: unknown };

const stockAll = ['XS', 'S', 'M', 'L', 'XL'].map((size) => ({ size, color: 'Grey', stock: 5, active: true }));
const toChart = (c: Entry) =>
  parseStoredChart({ id: c.name, notes: null, fit: null, stretch: null, ...(c as object) } as Parameters<typeof parseStoredChart>[0])!;

describe('owner-supplied size charts', () => {
  for (const c of SIZE_CHARTS as Entry[]) {
    test(`"${c.name}" passes admin validation and is verified`, () => {
      const parsed = sizeChartInputSchema.safeParse(c);
      assert.equal(parsed.success, true, JSON.stringify(parsed.success ? '' : parsed.error.issues));
      assert.equal(c.verified, true);
      assert.ok(String(c.source).length > 10);
    });
  }

  test('sweats chart: asks for height only (garment waist has no ease so is not compared)', () => {
    const chart = toChart((SIZE_CHARTS as Entry[])[0]);
    assert.deepEqual(inputFieldsForChart(chart), { required: ['HEIGHT'], optional: [] });
  });

  test('sweats chart: heights map to the sizes in the table (cm conversions of the feet/inches rows)', () => {
    const chart = toChart((SIZE_CHARTS as Entry[])[0]);
    const pick = (h: number) => recommendSize(chart, { measurements: { HEIGHT: h }, preferredFit: null }, stockAll, 'Grey');
    assert.equal(pick(150).recommendedSize, 'XS'); // 4'11"
    assert.equal(pick(165).recommendedSize, 'S'); // 5'5"
    assert.equal(pick(175).recommendedSize, 'M'); // 5'9"
    assert.equal(pick(186).recommendedSize, 'L'); // 6'1"
    assert.equal(pick(195).recommendedSize, 'XL'); // 6'5"
  });

  test('sweats chart: height-only results are labelled preliminary and never high confidence', () => {
    const chart = toChart((SIZE_CHARTS as Entry[])[0]);
    for (const h of [150, 165, 175, 186, 195]) {
      const r = recommendSize(chart, { measurements: { HEIGHT: h }, preferredFit: null }, stockAll, 'Grey');
      assert.notEqual(r.confidence, 'high');
      assert.equal(r.basis.preliminaryOnly, true);
    }
  });

  test('sweats chart: a height in the gap between two rows is an estimate between two sizes', () => {
    const chart = toChart((SIZE_CHARTS as Entry[])[0]);
    const r = recommendSize(chart, { measurements: { HEIGHT: 160 }, preferredFit: null }, stockAll, 'Grey');
    assert.equal(r.status, 'recommended');
    assert.ok(['XS', 'S'].includes(r.recommendedSize!));
    assert.ok(r.alternativeSize !== null);
  });

  test('sizes MERRIER does not make (XS) are reported as unavailable, not substituted blindly', () => {
    const chart = toChart((SIZE_CHARTS as Entry[])[0]);
    const noXS = stockAll.filter((v) => v.size !== 'XS');
    const r = recommendSize(chart, { measurements: { HEIGHT: 150 }, preferredFit: null }, noXS, 'Grey');
    assert.equal(r.status, 'unavailable');
    assert.equal(r.idealSize, 'XS');
  });
});
