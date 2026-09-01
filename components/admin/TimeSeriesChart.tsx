'use client';

import { useState } from 'react';
import { EmptyState } from './EmptyState';

export interface ChartBucket {
  bucketStart: string; // ISO date string
  value: number;
}

function formatBucketLabel(iso: string, granularity: 'day' | 'week' | 'month'): string {
  const d = new Date(iso);
  if (granularity === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  if (granularity === 'week') return `Wk ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const WIDTH = 720;
const HEIGHT = 220;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

/**
 * A single reusable inline-SVG line/area chart — used for both the Revenue
 * and Orders time series (on Overview and on the Analytics page) so there's
 * exactly one charting implementation to maintain, no chart library
 * dependency, and consistent look/interaction everywhere it appears.
 */
export function TimeSeriesChart({
  buckets,
  granularity,
  formatValue,
  color = 'var(--accent)',
  ariaLabel,
}: {
  buckets: ChartBucket[];
  granularity: 'day' | 'week' | 'month';
  formatValue: (value: number) => string;
  color?: string;
  ariaLabel: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const hasData = buckets.length > 0 && buckets.some((b) => b.value > 0);
  if (buckets.length === 0) {
    return <EmptyState title="No data" message="Nothing recorded in this period yet." />;
  }

  const maxValue = Math.max(1, ...buckets.map((b) => b.value));
  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = buckets.length > 1 ? innerWidth / (buckets.length - 1) : 0;

  const points = buckets.map((b, i) => {
    const x = PAD_LEFT + (buckets.length > 1 ? i * stepX : innerWidth / 2);
    const y = PAD_TOP + innerHeight - (b.value / maxValue) * innerHeight;
    return { x, y, ...b };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${PAD_TOP + innerHeight} L${points[0].x.toFixed(1)},${PAD_TOP + innerHeight} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  // Thin out x-axis labels so they never overlap on a wide range.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="admin-chart-wrap" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        {gridLines.map((g) => {
          const y = PAD_TOP + innerHeight * (1 - g);
          return (
            <g key={g}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--ink-soft)">
                {formatValue(Math.round(maxValue * g))}
              </text>
            </g>
          );
        })}

        {hasData && (
          <>
            <path d={areaPath} fill={color} opacity={0.12} stroke="none" />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
          </>
        )}

        {points.map((p, i) => (
          <g key={i}>
            {i % labelEvery === 0 && (
              <text x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="var(--ink-soft)">
                {formatBucketLabel(p.bucketStart, granularity)}
              </text>
            )}
            {hasData && <circle cx={p.x} cy={p.y} r={hoverIndex === i ? 4 : 2.5} fill={color} />}
            <rect
              x={p.x - stepX / 2}
              y={PAD_TOP}
              width={stepX || innerWidth}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
            />
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="admin-chart-tooltip"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
        >
          <div>{formatBucketLabel(hovered.bucketStart, granularity)}</div>
          <strong>{formatValue(hovered.value)}</strong>
        </div>
      )}
    </div>
  );
}
