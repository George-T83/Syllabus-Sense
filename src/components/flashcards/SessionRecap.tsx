'use client';

import { useEffect, useState } from 'react';
import { RingGauge } from '@/components/ui/RingGauge';
import { ForgettingCurveChart } from '@/components/flashcards/ForgettingCurveChart';
import { calibrationPct, type SessionStats } from '@/lib/flashcards/session';
import type { CurvePoint, UpcomingExam } from '@/lib/flashcards/memory';

export interface CourseOutcome {
  courseId: string;
  code: string;
  exam: UpcomingExam | null;
  before: number;
  after: number;
  curve: CurvePoint[];
}

export interface SessionRecapProps {
  stats: SessionStats;
  durationMs: number;
  /** Most-reviewed course first - it gets the headline and the chart. */
  outcomes: CourseOutcome[];
  nextReview: { date: Date; count: number } | null;
  onDone: () => void;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

function useCountUp(to: number, from: number, ms = 1400) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setValue(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, from, ms]);
  return value;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function formatDuration(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function examLine(exam: UpcomingExam | null) {
  if (!exam) return 'No exam on the calendar · one-week outlook';
  const when =
    exam.daysAway === 0 ? 'today' : exam.daysAway === 1 ? 'tomorrow' : `in ${exam.daysAway} days`;
  const weight = exam.item.gradeWeight ? ` · ${exam.item.gradeWeight}% of grade` : '';
  return `${exam.item.title}${weight} · ${when}`;
}

export function SessionRecap({
  stats,
  durationMs,
  outcomes,
  nextReview,
  onDone,
}: SessionRecapProps) {
  const primary = outcomes[0];
  const shown = useCountUp(primary?.after ?? 0, primary?.before ?? 0);
  const deltaPts = primary ? Math.round((primary.after - primary.before) * 100) : 0;
  const calibration = calibrationPct(stats);
  const last = primary?.curve[primary.curve.length - 1];

  const tiles = [
    {
      label: 'Recalled',
      value: `${stats.recalled}/${stats.reviewed}`,
      note: stats.reviewed
        ? `${Math.round((stats.recalled / stats.reviewed) * 100)}% on the first try`
        : '',
    },
    {
      label: 'Calibration',
      value: calibration === null ? '—' : pct(calibration),
      note:
        calibration === null
          ? 'Make a gut call before flipping to track this'
          : 'of your gut calls were right',
    },
    { label: 'Best combo', value: `×${stats.bestCombo}`, note: 'cards in a row' },
    { label: 'Points', value: stats.points.toLocaleString(), note: 'earned this session' },
  ];

  return (
    <div className="study-rise mx-auto my-auto w-full max-w-3xl space-y-5 pb-10">
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {stats.reviewed} {stats.reviewed === 1 ? 'card' : 'cards'} · {formatDuration(durationMs)}
        </p>
        <h2
          id="flashcard-review-title"
          className="mt-2 font-display text-4xl text-foreground sm:text-5xl"
        >
          Session complete
        </h2>
      </header>

      {primary && (
        <section className="study-panel flex flex-col items-center gap-5 rounded-3xl p-6 sm:flex-row sm:p-8">
          <RingGauge
            variant="brand"
            progress={shown}
            size={132}
            radius={54}
            strokeWidth={10}
            aria-label={`${primary.code} exam readiness ${pct(primary.after)}`}
          >
            <span className="font-display text-3xl tabular-nums text-foreground">{pct(shown)}</span>
          </RingGauge>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {primary.code} · exam readiness
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{examLine(primary.exam)}</p>
            <p className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
              <span className="font-display text-2xl tabular-nums text-muted-foreground">
                {pct(primary.before)}
              </span>
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
              <span className="font-display text-4xl tabular-nums text-foreground">
                {pct(primary.after)}
              </span>
              {deltaPts !== 0 && (
                <span
                  className={
                    deltaPts > 0
                      ? 'rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm font-semibold text-emerald-300'
                      : 'rounded-full bg-white/5 px-2.5 py-0.5 text-sm font-semibold text-muted-foreground'
                  }
                >
                  {deltaPts > 0 ? `+${deltaPts}` : deltaPts}
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Average projected recall on exam day across every card in this deck, if you stopped
              studying now.
            </p>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="study-panel rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{t.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.note}</p>
          </div>
        ))}
      </section>

      {primary && last && (
        <section className="study-panel rounded-3xl p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground">
            Where {primary.code} goes from here
          </h3>
          <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
            Projected recall across the deck, from today to{' '}
            {primary.exam ? primary.exam.item.title : 'a week from now'}.
          </p>
          <ForgettingCurveChart
            points={primary.curve}
            targetLabel={primary.exam ? primary.exam.item.title : 'Next week'}
          />
          {nextReview && (
            <p className="mt-4 rounded-2xl bg-primary/10 px-4 py-3 text-sm text-foreground ring-1 ring-primary/25">
              Come back{' '}
              <strong>
                {nextReview.date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </strong>{' '}
              for {nextReview.count} {nextReview.count === 1 ? 'card' : 'cards'}. Keeping up takes
              exam-day recall from <strong>{pct(last.stopNow)}</strong> to{' '}
              <strong>{pct(last.onSchedule)}</strong>.
            </p>
          )}
        </section>
      )}

      {outcomes.length > 1 && (
        <section className="study-panel rounded-3xl p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Every course in this session
          </h3>
          <ul className="space-y-2">
            {outcomes.map((o) => (
              <li key={o.courseId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {o.code} <span className="text-muted-foreground">· {examLine(o.exam)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {pct(o.before)} →{' '}
                  <span className="font-semibold text-foreground">{pct(o.after)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-gradient-brand px-8 text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(91,61,245,0.8)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
