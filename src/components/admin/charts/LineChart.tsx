// Server-rendered SVG line chart using design tokens (no client charting library, admin.md §4).
export interface LineSeries {
  label: string;
  /** CSS color, e.g. `var(--color-terracotta)`. */
  color: string;
  values: number[];
  /** Pre-formatted values for the data table / tooltips. */
  formatted: string[];
}

interface LineChartProps {
  title: string;
  periods: string[];
  series: LineSeries[];
  emptyLabel: string;
}

const W = 640;
const H = 220;
const PAD = { top: 12, side: 8, bottom: 28 };

export function LineChart({ title, periods, series, emptyLabel }: LineChartProps) {
  if (periods.length === 0 || series.length === 0) {
    return <p className="py-10 text-center text-stone">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const innerW = W - PAD.side * 2;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.side + (periods.length === 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const first = periods[0] ?? '';
  const last = periods[periods.length - 1] ?? '';

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full" preserveAspectRatio="none">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={PAD.side} x2={W - PAD.side} y1={PAD.top + innerH * f} y2={PAD.top + innerH * f} stroke="var(--color-hairline)" />
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            />
            {s.values.map((v, i) => (
              <circle key={periods[i]} cx={x(i)} cy={y(v)} r={3} fill={s.color}>
                <title>{`${s.label} · ${periods[i]}: ${s.formatted[i] ?? v}`}</title>
              </circle>
            ))}
          </g>
        ))}
        <text x={PAD.side} y={H - 8} fontSize={11} fill="var(--color-muted)">
          {first}
        </text>
        <text x={W - PAD.side} y={H - 8} fontSize={11} fill="var(--color-muted)" textAnchor="end">
          {last}
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-eyebrow">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-pill" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
