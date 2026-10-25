// Tests for customer input validation and admin chart validation.
// Run: npm run test:sizing
// All chart values are synthetic TEST DATA.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateMeasurements, parseMeasurement } from '../../lib/sizing/input';
import { sizeChartInputSchema, parseStoredChart } from '../../lib/sizing/chart-schema';
import { normalizeSizeLabel } from '../../lib/sizing/measurements';

const HW = { required: ['HEIGHT', 'WEIGHT'] as const, optional: ['CHEST', 'WAIST'] as const };
const fields = { required: [...HW.required], optional: [...HW.optional] };

describe('customer input', () => {
  test('accepts valid values and rounds to one decimal', () => {
    const r = validateMeasurements({ HEIGHT: '175', WEIGHT: '70,55', CHEST: '98.25' }, fields);
    assert.equal(r.valid, true);
    assert.deepEqual(r.measurements, { HEIGHT: 175, WEIGHT: 70.6, CHEST: 98.3 });
  });

  test('required fields must be filled; optional may be empty', () => {
    const r = validateMeasurements({ HEIGHT: '', WEIGHT: '70' }, fields);
    assert.equal(r.valid, false);
    assert.match(r.errors.HEIGHT!, /Enter your height in centimetres/);
    assert.equal(r.errors.CHEST, undefined);
  });

  test('rejects non-numeric, negative, zero and malformed numbers', () => {
    for (const bad of ['abc', '-170', '0', '17 5', '1e3', '175cm', '1,75,0', '.', '']) {
      const r = validateMeasurements({ HEIGHT: bad, WEIGHT: '70' }, fields);
      assert.equal(r.valid, false, `"${bad}" should be rejected`);
    }
  });

  test('rejects impossible values with a range message', () => {
    const r = validateMeasurements({ HEIGHT: '300', WEIGHT: '5' }, fields);
    assert.match(r.errors.HEIGHT!, /between 120 and 230 cm/);
    assert.match(r.errors.WEIGHT!, /between 30 and 250 kg/);
  });

  test('catches common wrong units', () => {
    assert.match(validateMeasurements({ HEIGHT: '5.9', WEIGHT: '70' }, fields).errors.HEIGHT!, /feet/);
    assert.match(validateMeasurements({ HEIGHT: '175', WEIGHT: '70', CHEST: '40' }, fields).errors.CHEST!, /inches/);
    assert.match(validateMeasurements({ HEIGHT: '175', WEIGHT: '700' }, fields).errors.WEIGHT!, /kilograms/);
  });

  test('boundary values are accepted, just outside are rejected', () => {
    assert.equal(validateMeasurements({ HEIGHT: '120', WEIGHT: '30' }, fields).valid, true);
    assert.equal(validateMeasurements({ HEIGHT: '230', WEIGHT: '250' }, fields).valid, true);
    assert.equal(validateMeasurements({ HEIGHT: '119.9', WEIGHT: '30' }, fields).valid, false);
    assert.equal(validateMeasurements({ HEIGHT: '230.1', WEIGHT: '250' }, fields).valid, false);
  });

  test('ignores fields the chart did not ask for', () => {
    const r = validateMeasurements({ HEIGHT: '175', WEIGHT: '70', HIPS: '95' }, fields);
    assert.deepEqual(Object.keys(r.measurements).sort(), ['HEIGHT', 'WEIGHT']);
  });

  test('parseMeasurement', () => {
    assert.equal(parseMeasurement(' 12,5 '), 12.5);
    assert.equal(parseMeasurement('NaN'), null);
    assert.equal(parseMeasurement('1000'), null);
  });
});

const validChart = () => ({
  name: 'TEST chart',
  basis: 'BODY' as const,
  verified: true,
  source: 'Test fixture',
  sizes: [
    { size: 'S', measurements: { CHEST: { min: 88, max: 93 } } },
    { size: 'M', measurements: { CHEST: { min: 96, max: 101 } } },
  ],
});

describe('admin chart validation', () => {
  test('accepts a valid chart', () => {
    assert.equal(sizeChartInputSchema.safeParse(validChart()).success, true);
  });

  test('min larger than max is rejected', () => {
    const c = validChart();
    c.sizes[0].measurements.CHEST = { min: 95, max: 90 };
    assert.equal(sizeChartInputSchema.safeParse(c).success, false);
  });

  test('duplicate size labels are rejected, loosely compared', () => {
    const c = validChart();
    c.sizes[1].size = ' s ';
    const r = sizeChartInputSchema.safeParse(c);
    assert.equal(r.success, false);
    assert.match(JSON.stringify(r), /appears twice/);
  });

  test('sizes must run smallest to largest', () => {
    const c = validChart();
    c.sizes.reverse();
    const r = sizeChartInputSchema.safeParse(c);
    assert.equal(r.success, false);
    assert.match(JSON.stringify(r), /smallest to largest/);
  });

  test('implausible values and wrong units are rejected', () => {
    const c = validChart();
    c.sizes[0].measurements.CHEST = { min: 1, max: 2 };
    assert.equal(sizeChartInputSchema.safeParse(c).success, false);
  });

  test('verified requires a source', () => {
    const c = { ...validChart(), source: '' };
    const r = sizeChartInputSchema.safeParse(c);
    assert.equal(r.success, false);
    assert.match(JSON.stringify(r), /where these measurements come from/);
    assert.equal(sizeChartInputSchema.safeParse({ ...c, verified: false }).success, true);
  });

  test('verified garment chart needs ease for at least one comparable column', () => {
    const garment = { ...validChart(), basis: 'GARMENT' as const };
    assert.equal(sizeChartInputSchema.safeParse(garment).success, false);
    assert.equal(sizeChartInputSchema.safeParse({ ...garment, ease: { CHEST: { min: 14, max: 20 } } }).success, true);
    // Display-only columns don't make a chart usable.
    const lengthOnly = { ...garment, sizes: [{ size: 'S', measurements: { LENGTH: { min: 68, max: 68 } } }] };
    assert.equal(sizeChartInputSchema.safeParse(lengthOnly).success, false);
  });

  test('ease on a body chart is rejected', () => {
    assert.equal(sizeChartInputSchema.safeParse({ ...validChart(), ease: { CHEST: { min: 1, max: 2 } } }).success, false);
  });
});

describe('stored chart parsing', () => {
  const row = (over = {}) => ({
    id: 'c1',
    name: 'TEST',
    basis: 'BODY',
    garmentFlat: false,
    fit: null,
    stretch: null,
    notes: null,
    source: 'Test fixture',
    verified: true,
    sizes: validChart().sizes,
    ease: {},
    ...over,
  });

  test('valid rows parse', () => {
    assert.equal(parseStoredChart(row())?.sizes.length, 2);
  });

  test('corrupted JSON in the database is dropped, not guessed at', () => {
    assert.equal(parseStoredChart(row({ sizes: 'nope' })), null);
    assert.equal(parseStoredChart(row({ sizes: [{ size: 'S', measurements: { CHEST: { min: 'a', max: 1 } } }] })), null);
    assert.equal(parseStoredChart(row({ basis: 'WHATEVER' })), null);
  });
});

describe('size label matching', () => {
  test('normalizes case, spacing and numeric X sizes', () => {
    assert.equal(normalizeSizeLabel(' x l '), 'XL');
    assert.equal(normalizeSizeLabel('2xl'), 'XXL');
    assert.equal(normalizeSizeLabel('3XL'), 'XXXL');
    assert.equal(normalizeSizeLabel('32'), '32');
  });
});
