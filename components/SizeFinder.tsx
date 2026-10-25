'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  recommendSize,
  inputFieldsForChart,
  type CustomerMeasurements,
  type Confidence,
  type SizeRecommendation,
} from '@/lib/sizing/engine';
import { validateMeasurements, type MeasurementErrors, type MeasurementFormValues } from '@/lib/sizing/input';
import {
  CUSTOMER_LIMITS,
  FIT_LABELS,
  MEASURING_TIPS,
  MEASUREMENT_LABELS,
  STRETCH_LABELS,
  chartColumns,
  formatRange,
  measurementUnit,
  type CustomerMeasurementKey,
  type FitPreference,
  type SizeChartData,
} from '@/lib/sizing/measurements';

type Variant = { size: string; color: string; stock: number; active: boolean };

const FIT_OPTIONS: { value: FitPreference; label: string; hint: string }[] = [
  { value: 'SLIM', label: 'Slim', hint: 'Closer to the body' },
  { value: 'REGULAR', label: 'Regular', hint: 'Standard fit' },
  { value: 'OVERSIZED', label: 'Oversized', hint: 'Roomier' },
];

const CONFIDENCE_COPY: Record<Confidence, { label: string; level: number; text: string }> = {
  high: {
    label: 'High confidence',
    level: 3,
    text: 'Your body measurements sit comfortably inside this size on the size chart.',
  },
  medium: {
    label: 'Medium confidence',
    level: 2,
    text: 'A reasonable match, but there is some uncertainty — see the notes below.',
  },
  low: {
    label: 'Low confidence',
    level: 1,
    text: 'Treat this as a rough guide only and compare with the size chart below.',
  },
};

export function SizeFinder({
  productName,
  chart,
  variants,
  selectedColor,
  onApply,
}: {
  productName: string;
  chart: SizeChartData | null;
  variants: Variant[];
  selectedColor: string;
  // Called with the variant's own size label; the parent selects it.
  onApply: (size: string) => void;
}) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);

  const fields = useMemo(() => (chart ? inputFieldsForChart(chart) : { required: [], optional: [] }), [chart]);
  const [values, setValues] = useState<MeasurementFormValues>({});
  const [errors, setErrors] = useState<MeasurementErrors>({});
  const [fit, setFit] = useState<FitPreference>('REGULAR');
  // The validated measurements behind the result currently shown. Kept in
  // memory only — nothing is sent anywhere or written to storage.
  const [submitted, setSubmitted] = useState<CustomerMeasurements | null>(null);
  const [submittedFit, setSubmittedFit] = useState<FitPreference>('REGULAR');

  // The result is derived, not stored: if the shopper changes colour while the
  // dialog is open (or after), availability is re-checked against that colour.
  const recommendation: SizeRecommendation | null = useMemo(() => {
    if (!chart || !submitted) return null;
    return recommendSize(
      chart,
      { measurements: submitted, preferredFit: submittedFit === 'REGULAR' ? null : submittedFit },
      variants,
      selectedColor
    );
  }, [chart, submitted, submittedFit, variants, selectedColor]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the first field rather than the close button (unless a result is showing).
      if (!submitted) dialog.querySelector<HTMLInputElement>('.sf-grid input')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recommendation) return;
    if (recommendation.status === 'needs_more_measurements' || recommendation.status === 'insufficient_data') {
      // The form is showing again: put the cursor on the measurement we're asking for.
      const next = recommendation.suggestedMeasurements[0];
      if (next) document.getElementById(`${uid}-${next}`)?.focus();
    } else {
      resultRef.current?.focus();
    }
  }, [submitted, recommendation?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chart) {
    // Nothing to recommend between when the product comes in a single size
    // (a cap, a bag...), so don't show a note about missing recommendations.
    if (new Set(variants.map((v) => v.size)).size <= 1) return null;
    return (
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>
        Size recommendations aren&apos;t available for this product yet.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateMeasurements(values, fields);
    setErrors(result.errors);
    if (!result.valid) {
      const firstBad = [...fields.required, ...fields.optional].find((k) => result.errors[k]);
      if (firstBad) document.getElementById(`${uid}-${firstBad}`)?.focus();
      return;
    }
    setSubmitted(result.measurements);
    setSubmittedFit(fit);
  }

  function apply(size: string) {
    onApply(size);
    setOpen(false);
  }

  function field(key: CustomerMeasurementKey, required: boolean) {
    const id = `${uid}-${key}`;
    const unit = measurementUnit(key);
    const { min, max } = CUSTOMER_LIMITS[key];
    const err = errors[key];
    return (
      <div className="field" key={key}>
        <label htmlFor={id}>
          {MEASUREMENT_LABELS[key]} <span className="sf-req">{required ? '(required)' : '(optional)'}</span>
        </label>
        <div className="sf-input">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder={`${min}–${max}`}
            value={values[key] ?? ''}
            aria-required={required}
            aria-invalid={err ? true : undefined}
            aria-describedby={`${id}-help${err ? ` ${id}-err` : ''}`}
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              if (err) setErrors((prev) => ({ ...prev, [key]: undefined }));
            }}
          />
          <span aria-hidden="true">{unit}</span>
        </div>
        <span id={`${id}-help`} className="sf-help">
          {MEASURING_TIPS[key]}
        </span>
        {err && (
          <span id={`${id}-err`} className="field-error" role="alert">
            {err}
          </span>
        )}
      </div>
    );
  }

  const columns = chartColumns(chart);
  const rec = recommendation;
  const canApply = rec?.status === 'recommended' && rec.recommendedSize;

  return (
    <>
      <button type="button" className="sf-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 17 17 3l4 4L7 21z" />
          <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
        </svg>
        Find my size
      </button>

      <dialog
        ref={dialogRef}
        className="sf-dialog"
        aria-labelledby={`${uid}-title`}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself) closes it.
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="sf-head">
          <div>
            <span className="eyebrow">Smart size finder</span>
            <h2 id={`${uid}-title`}>Find my size</h2>
            <p className="sf-sub">{productName}</p>
          </div>
          <button type="button" className="sf-close" onClick={() => setOpen(false)} aria-label="Close size finder">
            ×
          </button>
        </div>

        <div className="sf-body">
          {!rec || rec.status === 'needs_more_measurements' || rec.status === 'insufficient_data' ? (
            <form onSubmit={handleSubmit} noValidate>
              <p className="sf-privacy">
                Your measurements are compared with this product&apos;s size chart right here in your browser. They aren&apos;t
                sent to us, saved, or linked to your account.
              </p>

              {rec?.status === 'needs_more_measurements' && (
                <div className="sf-note sf-note-info" role="status">
                  <strong>{rec.summary}</strong>
                  {rec.reasons.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
              {rec?.status === 'insufficient_data' && (
                <div className="sf-note sf-note-warn" role="status">
                  <strong>{rec.summary}</strong>
                  {rec.warnings.map((w) => (
                    <div key={w}>{w}</div>
                  ))}
                </div>
              )}

              {fields.required.length === 0 ? (
                <div className="sf-note sf-note-warn" role="status">
                  <strong>We can&apos;t recommend a size for this product.</strong>
                  <div>Its size chart doesn&apos;t include measurements that can be compared with yours. Please use the size chart below.</div>
                </div>
              ) : (
                <>
                  <div className="sf-grid">{fields.required.map((k) => field(k, true))}</div>
                  {fields.optional.length > 0 && (
                    <>
                      <p className="sf-section">
                        {fields.required.some((k) => k === 'HEIGHT' || k === 'WEIGHT')
                          ? 'Add body measurements for a more reliable result'
                          : 'More measurements (optional)'}
                      </p>
                      <div className="sf-grid">{fields.optional.map((k) => field(k, false))}</div>
                    </>
                  )}

                  <fieldset className="sf-fit">
                    <legend>Preferred fit</legend>
                    <div className="sf-fit-options">
                      {FIT_OPTIONS.map((o) => (
                        <label key={o.value} className="sf-fit-option" data-checked={fit === o.value}>
                          <input type="radio" name={`${uid}-fit`} value={o.value} checked={fit === o.value} onChange={() => setFit(o.value)} />
                          <span>{o.label}</span>
                          <small>{o.hint}</small>
                        </label>
                      ))}
                    </div>
                    <span className="sf-help">Only matters when you&apos;re between two sizes.</span>
                  </fieldset>

                  <button type="submit" className="btn btn-primary sf-submit">
                    {rec ? 'Update recommendation' : 'Get my size'}
                  </button>
                </>
              )}
            </form>
          ) : (
            <ResultView
              rec={rec}
              selectedColor={selectedColor}
              resultRef={resultRef}
              canApply={!!canApply}
              onApply={apply}
              onEdit={() => setSubmitted(null)}
            />
          )}

          <details className="sf-chart">
            <summary>View size chart</summary>
            <p className="sf-help" style={{ marginTop: 8 }}>
              {chart.basis === 'BODY'
                ? 'Body measurements (cm / kg): the body each size is intended for.'
                : `Garment measurements (cm)${chart.garmentFlat ? ', laid flat — chest/waist/hips are half the full circumference' : ''}: the product itself, not your body.`}
              {chart.fit ? ` Cut: ${FIT_LABELS[chart.fit].toLowerCase()}.` : ''}
              {chart.stretch ? ` ${STRETCH_LABELS[chart.stretch]}.` : ''}
            </p>
            <div className="sf-table-wrap">
              <table className="sf-table">
                <thead>
                  <tr>
                    <th scope="col">Size</th>
                    {columns.map((k) => (
                      <th scope="col" key={k}>
                        {MEASUREMENT_LABELS[k]} ({measurementUnit(k)})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.sizes.map((row) => (
                    <tr key={row.size} data-recommended={rec?.recommendedSize === row.size || undefined}>
                      <th scope="row">{row.size}</th>
                      {columns.map((k) => (
                        <td key={k}>{row.measurements[k] ? formatRange(row.measurements[k]!, '').trim() : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {chart.notes && <p className="sf-help">{chart.notes}</p>}
          </details>
        </div>
      </dialog>
    </>
  );
}

function ResultView({
  rec,
  selectedColor,
  resultRef,
  canApply,
  onApply,
  onEdit,
}: {
  rec: SizeRecommendation;
  selectedColor: string;
  resultRef: React.RefObject<HTMLHeadingElement | null>;
  canApply: boolean;
  onApply: (size: string) => void;
  onEdit: () => void;
}) {
  const conf = rec.confidence ? CONFIDENCE_COPY[rec.confidence] : null;
  return (
    <div className="sf-result" aria-live="polite">
      {rec.status === 'recommended' && rec.recommendedSize ? (
        <>
          <p className="sf-label">Your recommended size</p>
          <div className="sf-rec-row">
            <h3 ref={resultRef} tabIndex={-1} className="sf-size">
              {rec.recommendedSize}
            </h3>
            {conf && (
              <div className="sf-conf" data-level={rec.confidence}>
                <div className="sf-meter" aria-hidden="true">
                  {[1, 2, 3].map((i) => (
                    <span key={i} data-on={i <= conf.level} />
                  ))}
                </div>
                <strong>{conf.label}</strong>
              </div>
            )}
          </div>
          <p className="sf-summary">{rec.summary}</p>
          {conf && <p className="sf-help">{conf.text}</p>}
        </>
      ) : (
        <>
          <p className="sf-label">{rec.status === 'unavailable' ? 'Best match unavailable' : 'No recommendation'}</p>
          <h3 ref={resultRef} tabIndex={-1} className="sf-heading">
            {rec.summary}
          </h3>
        </>
      )}

      {rec.warnings.length > 0 && (
        <ul className="sf-note sf-note-warn sf-list" aria-label="Things to know">
          {rec.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {rec.status === 'unavailable' && rec.otherColorsWithIdealSize.length > 0 && (
        <p className="sf-note sf-note-info">
          {rec.idealSize} is in stock in {rec.otherColorsWithIdealSize.join(', ')}. Your selected color is {selectedColor}.
        </p>
      )}

      {rec.reasons.length > 0 && (
        <>
          <p className="sf-section">Why this size</p>
          <ul className="sf-list">
            {rec.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}

      {rec.alternativeSize && (
        <div className="sf-alt">
          <span>
            Between sizes? <strong>{rec.alternativeSize}</strong> is also a close match.
          </span>
          <button type="button" className="sf-link" onClick={() => onApply(rec.alternativeSize!)}>
            Use {rec.alternativeSize} instead
          </button>
        </div>
      )}

      <p className="sf-help">
        Recommendations come from this product&apos;s size chart and are a guide, not a guarantee of fit.
      </p>

      <div className="sf-actions">
        {canApply && (
          <button type="button" className="btn btn-primary" onClick={() => onApply(rec.recommendedSize!)}>
            Apply this size
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onEdit}>
          Edit measurements
        </button>
      </div>
    </div>
  );
}
