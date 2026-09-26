'use client';

import { useId, useMemo } from 'react';
import {
  STANDARD_GRADE_SCALE,
  letterGradeToGpaPoints,
  percentageToLetterGrade,
  projectCourseGrade,
  type GradeCategory,
} from '@/lib/academic/gradeMath';
import { cn } from '@/lib/utils';

/** One hue per letter family; the +/- steps inside a family step its opacity. */
export const GRADE_GROUP_COLOR: Record<string, string> = {
  A: '#00a88c',
  B: '#6d51fa',
  C: '#d97706',
  D: '#ea580c',
  F: '#e11d48',
};

const groupOf = (letter: string) => letter.charAt(0);
const STEP_OPACITY: Record<string, number> = { '': 1, '+': 0.82, '-': 0.64 };

/** Letter bands as [min, max) percentage ranges, highest first. */
const BANDS = STANDARD_GRADE_SCALE.map((t, i) => ({
  letter: t.letter,
  min: t.minPercentage,
  max: i === 0 ? 100 : STANDARD_GRADE_SCALE[i - 1].minPercentage,
}));

// Dial geometry (viewBox units).
const W = 340;
const H = 206;
const CX = 170;
const CY = 184;
const R = 138;
const STROKE = 18;

export interface GradeOutcomeDialProps {
  floor: number;
  ceiling: number;
  projected: number;
  target: number;
  /** True once nothing is left to score: floor, ceiling and projection coincide. */
  locked?: boolean;
  className?: string;
}

/**
 * The course grade as a gauge: a half-dial banded by letter grade, with the
 * span you can still reach (the floor if you score 0% on what's left, the
 * ceiling if you score 100%) lit and everything outside it dimmed, a flag at
 * your goal, and a needle that swings to wherever the what-if slider puts you.
 */
export function GradeOutcomeDial({
  floor,
  ceiling,
  projected,
  target,
  locked,
  className,
}: GradeOutcomeDialProps) {
  // Most of 0-100 is one F band, so the dial starts near the floor instead.
  const lo = Math.max(0, Math.min(60, Math.floor(Math.min(floor, projected) / 10) * 10));
  const clampPct = (p: number) => Math.min(100, Math.max(lo, p));
  const angle = (p: number) => Math.PI * (1 - (clampPct(p) - lo) / (100 - lo));
  const at = (p: number, r = R) => ({
    x: CX + r * Math.cos(angle(p)),
    y: CY - r * Math.sin(angle(p)),
  });
  const arc = (a: number, b: number, r = R) => {
    const p = at(a, r);
    const q = at(b, r);
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} A ${r} ${r} 0 0 1 ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
  };

  const segments = BANDS.filter((b) => b.max > lo).flatMap((b) => {
    const a = Math.max(b.min, lo);
    const c = b.max;
    const inA = Math.max(a, floor);
    const inB = Math.min(c, ceiling);
    const color = GRADE_GROUP_COLOR[groupOf(b.letter)];
    const opacity = STEP_OPACITY[b.letter.slice(1)] ?? 1;
    const parts: { from: number; to: number; lit: boolean }[] = [];
    if (inA < inB) {
      if (a < inA) parts.push({ from: a, to: inA, lit: false });
      parts.push({ from: inA, to: inB, lit: true });
      if (inB < c) parts.push({ from: inB, to: c, lit: false });
    } else {
      parts.push({ from: a, to: c, lit: false });
    }
    return parts
      .filter((s) => s.to - s.from > 0.05)
      .map((s) => ({ ...s, key: `${b.letter}-${s.from}`, color, opacity }));
  });

  // Family labels (A, B, C, D, F) centred on the part of each family in view.
  const labels = ['A', 'B', 'C', 'D', 'F']
    .map((g) => {
      const fam = BANDS.filter((b) => groupOf(b.letter) === g);
      const min = Math.max(lo, Math.min(...fam.map((b) => b.min)));
      const max = Math.max(...fam.map((b) => b.max));
      return max - min >= 3 ? { g, p: at((min + max) / 2, R + 22) } : null;
    })
    .filter(Boolean) as { g: string; p: { x: number; y: number } }[];

  const needleDeg = ((clampPct(projected) - lo) / (100 - lo)) * 180 - 90;
  const letter = percentageToLetterGrade(projected);
  const goalInView = target >= lo && target <= 100;

  return (
    <div className={cn('relative mx-auto w-full max-w-[380px]', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`Projected course grade ${projected}%, ${letter}. Reachable range ${floor}% to ${ceiling}%. Goal ${percentageToLetterGrade(target)} at ${target}%.`}
      >
        <path
          d={arc(lo, 100)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={STROKE + 6}
          strokeLinecap="round"
        />
        {segments.map((s) => (
          <path
            key={s.key}
            d={arc(s.from + 0.15, s.to - 0.15)}
            fill="none"
            stroke={s.color}
            strokeOpacity={s.lit ? s.opacity : 0.16}
            strokeWidth={s.lit ? STROKE : STROKE - 8}
            className="transition-[stroke-opacity,stroke-width] duration-500"
          />
        ))}
        {!locked &&
          [floor, ceiling].map((p, i) => {
            const pt = at(p);
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={4.5}
                fill="hsl(var(--card))"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
              />
            );
          })}
        {labels.map(({ g, p }) => (
          <text
            key={g}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={700}
            fill="hsl(var(--muted-foreground))"
          >
            {g}
          </text>
        ))}
        {goalInView && (
          <g aria-hidden="true">
            <polygon
              points={(() => {
                const t = at(target, R + STROKE / 2 + 2);
                const b1 = at(target - 1.2, R + STROKE / 2 + 11);
                const b2 = at(target + 1.2, R + STROKE / 2 + 11);
                return `${t.x},${t.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`;
              })()}
              fill="hsl(var(--foreground))"
            />
          </g>
        )}
        {/* A pointer riding the inside of the arc: it swings around the
            dial's centre like a needle, but stops short of the readout. */}
        <g
          style={{
            transform: `rotate(${needleDeg}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
          }}
          className="transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
        >
          <path
            d={`M ${CX - 7} ${CY - R + 46} L ${CX} ${CY - R + STROKE / 2 + 4} L ${CX + 7} ${CY - R + 46} Z`}
            fill="hsl(var(--foreground))"
            stroke="hsl(var(--card))"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-[34%] flex flex-col items-center">
        <span
          key={letter}
          className="study-pop font-display text-6xl font-medium leading-none tracking-tight"
          style={{ color: GRADE_GROUP_COLOR[groupOf(letter)] }}
        >
          {letter}
        </span>
        <span className="mt-1 font-display text-2xl tabular-nums text-foreground">
          {projected}%
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {letterGradeToGpaPoints(letter).toFixed(1)} GPA
        </span>
      </div>
    </div>
  );
}

export interface RemainingScoreSliderProps {
  categories: GradeCategory[];
  remainingWeight: number;
  value: number;
  onChange: (score: number) => void;
  /** Score needed on what's left for the goal, if it's between 0 and 100. */
  goalScore: number | null;
  goalLetter: string;
  /** What's left, for the label ("the Final Exam"). */
  remainingLabel: string;
}

/**
 * "If you average X% on what's left": a range input whose track is colored
 * by the letter grade each score would earn, with a marker at the score the
 * goal needs.
 */
export function RemainingScoreSlider({
  categories,
  remainingWeight,
  value,
  onChange,
  goalScore,
  goalLetter,
  remainingLabel,
}: RemainingScoreSliderProps) {
  const id = useId();
  const { gradient, breaks } = useMemo(() => {
    const stops: string[] = [];
    const breaks: { score: number; group: string }[] = [];
    let prev = '';
    for (let s = 0; s <= 100; s++) {
      const g = groupOf(
        percentageToLetterGrade(projectCourseGrade(categories, remainingWeight, s)),
      );
      if (g !== prev) {
        if (prev) {
          stops.push(`${GRADE_GROUP_COLOR[prev]} ${s}%`);
          breaks.push({ score: s, group: g });
        }
        stops.push(`${GRADE_GROUP_COLOR[g]} ${s}%`);
        prev = g;
      }
    }
    stops.push(`${GRADE_GROUP_COLOR[prev]} 100%`);
    return { gradient: `linear-gradient(90deg, ${stops.join(', ')})`, breaks };
  }, [categories, remainingWeight]);

  const projected = projectCourseGrade(categories, remainingWeight, value);
  const letter = percentageToLetterGrade(projected);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-foreground">
        If you average <strong className="tabular-nums">{value}%</strong> on {remainingLabel}, you
        finish with{' '}
        <strong className="tabular-nums">
          {projected}% · {letter}
        </strong>
        .
      </label>
      <div className="relative pb-6 pt-3">
        {goalScore !== null && (
          <span
            className="absolute top-0 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide text-foreground"
            style={{ left: `${goalScore}%` }}
            aria-hidden="true"
          >
            ▾ {goalLetter}
          </span>
        )}
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${value}% on ${remainingLabel}: course grade ${projected}%, ${letter}`}
          className="grade-slider w-full"
          style={{ background: gradient }}
        />
        {breaks.map((b) => (
          <span
            key={b.score}
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground"
            style={{ left: `${b.score}%` }}
            aria-hidden="true"
          >
            {b.group} at {b.score}%
          </span>
        ))}
      </div>
    </div>
  );
}
