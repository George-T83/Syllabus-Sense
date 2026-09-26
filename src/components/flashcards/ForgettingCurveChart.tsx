'use client';

import { useId, useState } from 'react';
import type { CurvePoint } from '@/lib/flashcards/memory';

/** Validated against the session's dark surface (#101014) with the
 * dataviz palette checker - both clear lightness, CVD, and contrast. */
const STOP_NOW = '#6d51fa';
const ON_SCHEDULE = '#00a88c';

const W = 560;
const H = 220;
const PAD = { top: 16, right: 116, bottom: 30, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export interface ForgettingCurveChartProps {
  points: CurvePoint[];
  /** e.g. "Midterm" - labels the right edge. Omitted when no exam. */
  targetLabel: string;
}

/**
 * Deck-level recall from today to the exam (or a week out) under two
 * futures: stopping now vs. keeping up with the review schedule. The gap
 * between the lines is the whole argument for coming back.
 */
export function ForgettingCurveChart({ points, targetLabel }: ForgettingCurveChartProps) {
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const span = Math.max(1, points.length - 1);
  const x = (i: number) => PAD.left + (i / span) * PLOT_W;
  const y = (v: number) => PAD.top + (1 - v) * PLOT_H;

  const line = (key: 'stopNow' | 'onSchedule') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join('');
  const area = `${line('onSchedule')}L${x(span)},${y(0)}L${x(0)},${y(0)}Z`;

  const last = points[points.length - 1];
  let stopLabelY = y(last.stopNow);
  let scheduleLabelY = y(last.onSchedule);
  // Keep the two end labels from colliding - nudge apart on a leader line.
  if (Math.abs(stopLabelY - scheduleLabelY) < 30) {
    const mid = (stopLabelY + scheduleLabelY) / 2;
    scheduleLabelY = mid - 15;
    stopLabelY = mid + 15;
  }

  const pickIndex = (clientX: number, rect: DOMRect) => {
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((svgX - PAD.left) / PLOT_W) * span);
    return Math.max(0, Math.min(span, i));
  };

  const hovered = hover === null ? null : points[hover];

  return (
    <figure className="relative" aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">
        Projected recall from today to {targetLabel}: if you stop now, it falls to{' '}
        {pct(last.stopNow)}; if you keep up with reviews, it holds at {pct(last.onSchedule)}.
      </figcaption>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: ON_SCHEDULE }} />
          Keep up with reviews
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: STOP_NOW }} />
          Stop studying now
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
        role="img"
        aria-label={`Forgetting curve to ${targetLabel}`}
        tabIndex={0}
        onPointerMove={(e) =>
          setHover(pickIndex(e.clientX, e.currentTarget.getBoundingClientRect()))
        }
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover((h) => h ?? span)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? span) - 1));
          if (e.key === 'ArrowRight') setHover((h) => Math.min(span, (h ?? 0) + 1));
        }}
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={y(v)}
              y2={y(v)}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {pct(v)}
            </text>
          </g>
        ))}

        <path d={area} fill={ON_SCHEDULE} opacity={0.1} />
        <path
          d={line('stopNow')}
          fill="none"
          stroke={STOP_NOW}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={line('onSchedule')}
          fill="none"
          stroke={ON_SCHEDULE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line
          x1={x(span)}
          x2={x(span)}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          opacity={0.6}
        />

        {(
          [
            ['onSchedule', ON_SCHEDULE, scheduleLabelY],
            ['stopNow', STOP_NOW, stopLabelY],
          ] as const
        ).map(([key, color, labelY]) => (
          <g key={key}>
            <line
              x1={x(span) + 5}
              x2={x(span) + 14}
              y1={y(last[key])}
              y2={labelY}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={x(span)}
              cy={y(last[key])}
              r={4}
              fill={color}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
            <text
              x={x(span) + 18}
              y={labelY + 4}
              className="fill-foreground text-[12px] font-semibold tabular-nums"
            >
              {pct(last[key])}
            </text>
          </g>
        ))}

        <text x={PAD.left} y={H - 8} className="fill-muted-foreground text-[10px]">
          Today
        </text>
        <text
          x={x(span)}
          y={H - 8}
          textAnchor="middle"
          className="fill-foreground text-[10px] font-semibold"
        >
          {targetLabel} · {shortDate(last.date)}
        </text>

        {hovered && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="hsl(var(--foreground))"
              strokeWidth={1}
              opacity={0.35}
            />
            <circle
              cx={x(hover)}
              cy={y(hovered.onSchedule)}
              r={4}
              fill={ON_SCHEDULE}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
            <circle
              cx={x(hover)}
              cy={y(hovered.stopNow)}
              r={4}
              fill={STOP_NOW}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-[150px] -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card"
          style={{ left: `${(x(hover) / W) * 100}%` }}
          aria-hidden
        >
          <p className="mb-1 font-medium text-muted-foreground">
            {hover === 0 ? 'Today' : shortDate(hovered.date)}
          </p>
          <p className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: ON_SCHEDULE }} />
            <span className="font-bold tabular-nums text-foreground">
              {pct(hovered.onSchedule)}
            </span>
            <span className="text-muted-foreground">keep up</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: STOP_NOW }} />
            <span className="font-bold tabular-nums text-foreground">{pct(hovered.stopNow)}</span>
            <span className="text-muted-foreground">stop now</span>
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Projected recall by day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Keep up with reviews</th>
            <th scope="col">Stop studying now</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <th scope="row">{shortDate(p.date)}</th>
              <td>{pct(p.onSchedule)}</td>
              <td>{pct(p.stopNow)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
