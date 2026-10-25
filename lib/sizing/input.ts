// Validation for the customer-facing Find My Size form. Runs in the browser;
// returns plain numbers in cm/kg plus per-field, human-readable errors.

import {
  CUSTOMER_LIMITS,
  MEASUREMENT_LABELS,
  measurementUnit,
  type CustomerMeasurementKey,
} from './measurements';
import type { CustomerMeasurements } from './engine';

export type MeasurementFormValues = Partial<Record<CustomerMeasurementKey, string>>;
export type MeasurementErrors = Partial<Record<CustomerMeasurementKey, string>>;

const NUMBER_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
const CM_PER_INCH = 2.54;

function unitWord(key: CustomerMeasurementKey) {
  return measurementUnit(key) === 'kg' ? 'kilograms' : 'centimetres';
}

function example(key: CustomerMeasurementKey) {
  const examples: Record<CustomerMeasurementKey, string> = {
    HEIGHT: '175',
    WEIGHT: '70',
    CHEST: '98',
    WAIST: '82',
    HIPS: '98',
    INSEAM: '80',
  };
  return examples[key];
}

function outOfRangeMessage(key: CustomerMeasurementKey, value: number): string {
  const { min, max } = CUSTOMER_LIMITS[key];
  const label = MEASUREMENT_LABELS[key];
  const unit = measurementUnit(key);

  // Catch the common wrong-unit mistakes explicitly instead of a bare range error.
  if (key === 'HEIGHT' && value < 10) {
    return 'That looks like feet. Please enter your height in centimetres (e.g. 175).';
  }
  if (key === 'WEIGHT' && value > max) {
    return `Please enter your weight in kilograms, between ${min} and ${max} kg.`;
  }
  if (unit === 'cm' && value < min && value * CM_PER_INCH >= min && value * CM_PER_INCH <= max) {
    return `That looks like inches. Please enter centimetres (1 in = 2.54 cm, so ${value} in ≈ ${Math.round(value * CM_PER_INCH)} cm).`;
  }
  return `${label} must be between ${min} and ${max} ${unit}.`;
}

/** Parses one field. Accepts a comma as the decimal separator. */
export function parseMeasurement(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!NUMBER_PATTERN.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

/**
 * Validates the form. Only `required` and `optional` fields are read — any
 * other value is ignored, so nothing the chart can't use is ever collected.
 */
export function validateMeasurements(
  values: MeasurementFormValues,
  fields: { required: CustomerMeasurementKey[]; optional: CustomerMeasurementKey[] }
): { measurements: CustomerMeasurements; errors: MeasurementErrors; valid: boolean } {
  const measurements: CustomerMeasurements = {};
  const errors: MeasurementErrors = {};

  for (const key of [...fields.required, ...fields.optional]) {
    const raw = (values[key] ?? '').trim();
    const label = MEASUREMENT_LABELS[key];
    if (raw === '') {
      if (fields.required.includes(key)) errors[key] = `Enter your ${label.toLowerCase()} in ${unitWord(key)}.`;
      continue;
    }
    const value = parseMeasurement(raw);
    if (value === null || value <= 0) {
      errors[key] = `Enter a number in ${unitWord(key)}, e.g. ${example(key)}.`;
      continue;
    }
    const { min, max } = CUSTOMER_LIMITS[key];
    if (value < min || value > max) {
      errors[key] = outOfRangeMessage(key, value);
      continue;
    }
    measurements[key] = value;
  }

  return { measurements, errors, valid: Object.keys(errors).length === 0 };
}
