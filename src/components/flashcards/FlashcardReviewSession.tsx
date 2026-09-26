'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RingGauge } from '@/components/ui/RingGauge';
import { useModalA11y } from '@/hooks/useModalA11y';
import { cn } from '@/lib/utils';
import { applySM2, type ReviewRating } from '@/lib/flashcards/sm2';
import { toDayKey } from '@/lib/calendar/dates';
import {
  EMPTY_STATS,
  OUTCOME_COPY,
  flowLevel,
  isRecalled,
  recordReview,
  type Confidence,
  type SessionStats,
} from '@/lib/flashcards/session';
import {
  forgettingCurve,
  memoryTier,
  nextExamForCourse,
  nextReviewDate,
  readiness,
  readinessTarget,
  recallOn,
  type UpcomingExam,
} from '@/lib/flashcards/memory';
import {
  StudySpaceCanvas,
  type StudySpaceHandle,
  type StudySpaceStar,
} from '@/components/flashcards/StudySpaceCanvas';
import { SessionRecap, type CourseOutcome } from '@/components/flashcards/SessionRecap';
import { TIER_COLOR, TIER_LABEL } from '@/components/flashcards/MemoryTiles';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

/** How far a rated card flies, and how long - the next card is only
 * swapped in once the old one has left the frame. */
const EXIT_DISTANCE_PX = 620;
const EXIT_MS = 320;
/** Below this drag distance a release is a tap (flip), not a swipe. */
const TAP_THRESHOLD_PX = 6;
/** Past this drag distance a release commits to a rating. */
const SWIPE_THRESHOLD_PX = 110;
const MAX_GHOSTS = 2;
const FEEDBACK_MS = 1700;
/** Flow level at which the card's edge comes alive - "in the zone". */
const ZONE_FLOW = 0.5;

const RATINGS: { rating: ReviewRating; label: string; key: string; className: string }[] = [
  {
    rating: 'again',
    label: 'Again',
    key: '1',
    className:
      'bg-rose-500/15 text-rose-700 ring-rose-400/40 hover:bg-rose-500/25 dark:text-rose-200 dark:ring-rose-400/30',
  },
  {
    rating: 'hard',
    label: 'Hard',
    key: '2',
    className:
      'bg-amber-500/15 text-amber-700 ring-amber-400/40 hover:bg-amber-500/25 dark:text-amber-200 dark:ring-amber-400/30',
  },
  {
    rating: 'good',
    label: 'Good',
    key: '3',
    className:
      'bg-violet-500/15 text-violet-700 ring-violet-400/50 hover:bg-violet-500/25 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-400/40',
  },
  {
    rating: 'easy',
    label: 'Easy',
    key: '4',
    className:
      'bg-emerald-500/15 text-emerald-700 ring-emerald-400/40 hover:bg-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/30',
  },
];

const CONFIDENCE: { value: Confidence; label: string; key: string }[] = [
  { value: 'know', label: 'Know it', key: '1' },
  { value: 'think', label: 'Think so', key: '2' },
  { value: 'unsure', label: 'No idea', key: '3' },
];

export interface FlashcardReviewSessionProps {
  /** Snapshot of the cards due when the session opened - frozen so a card
   * rescheduled mid-session doesn't reshuffle the queue out from under the
   * student. `null` means the session is closed. */
  cards: Flashcard[] | null;
  /** Every flashcard, live - readiness is measured across whole decks, and
   * updates as each rating is saved. Defaults to the session's own cards. */
  allCards?: Flashcard[];
  courses?: Course[];
  scheduleItems?: ScheduleItem[];
  onClose: () => void;
  onRate: (card: Flashcard, rating: ReviewRating) => Promise<void>;
}

interface CourseContext {
  id: string;
  code: string;
  deck: Flashcard[];
  exam: UpcomingExam | null;
  target: Date;
  readiness: number;
}

interface Feedback {
  id: number;
  title: string;
  detail: string;
  tone: 'win' | 'miss';
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const intervalLabel = (days: number) => (days <= 1 ? 'tomorrow' : `in ${days} days`);
const intervalShort = (days: number) => (days <= 1 ? '1 day' : `${days} days`);

function examChip(exam: UpcomingExam | null) {
  if (!exam) return 'No exam scheduled · 7-day outlook';
  const when =
    exam.daysAway === 0 ? 'today' : exam.daysAway === 1 ? 'tomorrow' : `in ${exam.daysAway} days`;
  const weight = exam.item.gradeWeight ? ` · ${exam.item.gradeWeight}%` : '';
  return `${exam.item.title}${weight} · ${when}`;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="hidden rounded-md border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/60 sm:inline-block">
      {children}
    </kbd>
  );
}

export function FlashcardReviewSession({
  cards,
  allCards,
  courses = [],
  scheduleItems = [],
  onClose,
  onRate,
}: FlashcardReviewSessionProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [rating, setRating] = useState(false);
  const [exit, setExit] = useState<{ dir: 1 | -1 } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [results, setResults] = useState<Record<string, 'recalled' | 'lapsed'>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [today, setToday] = useState(() => new Date());
  const [durationMs, setDurationMs] = useState(0);
  const [baseline, setBaseline] = useState<Record<string, number>>({});

  const dragStartXRef = useRef<number | null>(null);
  const canvasRef = useRef<StudySpaceHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef(0);
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  const open = !!cards;
  const dialogRef = useModalA11y<HTMLDivElement>(open, handleClose);

  const queue = useMemo(() => cards ?? [], [cards]);
  const deckSource = allCards ?? queue;
  const done = open && index >= queue.length;
  const card = done ? null : (queue[index] ?? null);

  const contexts = useMemo(() => {
    const map = new Map<string, CourseContext>();
    for (const courseId of new Set(queue.map((c) => c.courseId))) {
      const deck = deckSource.filter((c) => c.courseId === courseId);
      const exam = nextExamForCourse(courseId, scheduleItems, today);
      const target = readinessTarget(exam, today);
      map.set(courseId, {
        id: courseId,
        code: courses.find((c) => c.id === courseId)?.code ?? 'Deck',
        deck,
        exam,
        target,
        readiness: readiness(deck, target, { today }),
      });
    }
    return map;
  }, [queue, deckSource, scheduleItems, courses, today]);

  // Snapshot readiness and the clock once per session, when it opens.
  useEffect(() => {
    if (!cards) return;
    const now = new Date();
    setToday(now);
    startedAtRef.current = Date.now();
    const snapshot: Record<string, number> = {};
    for (const courseId of new Set(cards.map((c) => c.courseId))) {
      const deck = (allCards ?? cards).filter((c) => c.courseId === courseId);
      const target = readinessTarget(nextExamForCourse(courseId, scheduleItems, now), now);
      snapshot[courseId] = readiness(deck, target, { today: now });
    }
    setBaseline(snapshot);
    // Deliberately keyed on the session opening only - the baseline is the
    // "before" a recap compares against, so it must not follow live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  // useModalA11y focuses the first button (Close), where Space - the key the
  // card itself advertises for flipping - would close the session instead.
  // Start on the card. Declared after useModalA11y so this runs second.
  useEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const stars: StudySpaceStar[] = useMemo(
    () =>
      queue.map((c, i) => ({
        id: c.id,
        strength: recallOn(c, today),
        state: results[c.id] ?? (i === index && !done ? 'current' : 'pending'),
      })),
    [queue, results, index, done, today],
  );

  function resetCardState() {
    setRevealed(false);
    setConfidence(null);
    setDragX(0);
    resetTilt();
  }

  function handleClose() {
    setIndex(0);
    setExit(null);
    setStats(EMPTY_STATS);
    setResults({});
    setFeedback(null);
    resetCardState();
    onClose();
  }

  function flip(conf: Confidence | null) {
    if (conf) setConfidence(conf);
    setRevealed((r) => !r);
  }

  const ctx = card ? (contexts.get(card.courseId) ?? null) : null;
  const flow = flowLevel(stats.combo);

  const handleRate = async (r: ReviewRating) => {
    if (!card || rating || exit) return;
    setRating(true);

    let delta = 0;
    if (ctx) {
      const next = { ...card, ...applySM2(card, r, today), lastReviewedAt: today.toISOString() };
      const deck = ctx.deck.map((c) => (c.id === card.id ? next : c));
      delta = readiness(deck, ctx.target, { today }) - ctx.readiness;
    }
    const result = recordReview(stats, confidence, r);
    const rect = cardRef.current?.getBoundingClientRect();
    setExit({ dir: isRecalled(r) ? 1 : -1 });

    try {
      await Promise.all([
        onRate(card, r),
        new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : EXIT_MS)),
      ]);
      const recalled = isRecalled(r);
      const milestone = recalled && result.stats.combo >= 5 && result.stats.combo % 5 === 0;
      setStats(result.stats);
      setResults((prev) => ({ ...prev, [card.id]: recalled ? 'recalled' : 'lapsed' }));
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (recalled) {
          canvasRef.current?.celebrate(
            cx,
            cy,
            card.id,
            result.outcome === 'called-it' || milestone,
          );
        } else {
          canvasRef.current?.fizzle(cx, cy);
        }
      }
      const deltaPts = Math.round(delta * 1000) / 10;
      setFeedback({
        id: Date.now(),
        tone: recalled ? 'win' : 'miss',
        title: milestone
          ? `${result.stats.combo} in a row — you’re in the zone`
          : (OUTCOME_COPY[result.outcome] ??
            (recalled ? (r === 'easy' ? 'Effortless' : 'Got it') : 'Back in the deck')),
        detail: recalled
          ? `+${result.pointsEarned} pts${deltaPts > 0 ? ` · readiness +${deltaPts}%` : ''}`
          : `Returns ${intervalLabel(applySM2(card, r, today).interval)}${
              result.pointsEarned ? ` · +${result.pointsEarned} pts` : ''
            }`,
      });
      if (index + 1 >= queue.length) setDurationMs(Date.now() - startedAtRef.current);
      setIndex((i) => i + 1);
      resetCardState();
    } catch {
      // onRate already surfaced an error toast - snap the card back onto the
      // stack instead of advancing past a rating that was never saved.
    } finally {
      setExit(null);
      setRating(false);
    }
  };

  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (done || !card || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target?.closest('input, textarea, select')) return;
    const onButton = target?.tagName === 'BUTTON';
    if (!revealed) {
      if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
        e.preventDefault();
        flip(null);
        return;
      }
      const call = CONFIDENCE.find((c) => c.key === e.key);
      if (call) {
        e.preventDefault();
        flip(call.value);
      }
      return;
    }
    const choice =
      RATINGS.find((o) => o.key === e.key)?.rating ??
      (e.key === 'ArrowLeft' ? 'again' : e.key === 'ArrowRight' ? 'good' : null);
    if (choice) {
      e.preventDefault();
      void handleRate(choice);
    } else if (e.key === ' ' && !onButton) {
      e.preventDefault();
      flip(null);
    }
  };

  function resetTilt() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0');
    el.style.setProperty('--tilt-y', '0');
    el.style.setProperty('--gx', '50%');
    el.style.setProperty('--gy', '0%');
  }

  function handleTilt(e: React.PointerEvent) {
    const el = tiltRef.current;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!el || !rect || dragging || exit || prefersReducedMotion()) return;
    const px = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    const py = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    el.style.setProperty('--tilt-x', px.toFixed(3));
    el.style.setProperty('--tilt-y', py.toFixed(3));
    el.style.setProperty('--gx', `${((px + 1) / 2) * 100}%`);
    el.style.setProperty('--gy', `${((py + 1) / 2) * 100}%`);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (exit || rating) return;
    // Keep receiving moves once the pointer outruns the card mid-swipe.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStartXRef.current = e.clientX;
    setDragging(true);
    resetTilt();
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragStartXRef.current === null) return;
    setDragX(revealed ? e.clientX - dragStartXRef.current : 0);
  }

  function endDrag() {
    if (dragStartXRef.current === null) return;
    const dx = dragX;
    dragStartXRef.current = null;
    setDragging(false);
    setDragX(0);
    if (Math.abs(dx) < TAP_THRESHOLD_PX) {
      flip(null);
      return;
    }
    if (!revealed) return;
    if (dx > SWIPE_THRESHOLD_PX) void handleRate('good');
    else if (dx < -SWIPE_THRESHOLD_PX) void handleRate('again');
  }

  if (!cards) return null;

  const stack = done ? [] : queue.slice(index, index + 1 + MAX_GHOSTS);
  const swipeTint = clamp(Math.abs(dragX) / SWIPE_THRESHOLD_PX, 0, 1);
  const inZone = flow >= ZONE_FLOW;

  const cardStyle = (position: number): React.CSSProperties => {
    if (position === 0) {
      if (exit) {
        return {
          transform: `translateX(${exit.dir * EXIT_DISTANCE_PX}px) translateY(-40px) rotate(${exit.dir * 18}deg) scale(0.92)`,
          opacity: 0,
          transition: `transform ${EXIT_MS}ms cubic-bezier(0.5, 0, 0.75, 0), opacity ${EXIT_MS}ms ease-in`,
          zIndex: 10,
        };
      }
      return {
        transform: dragX ? `translateX(${dragX}px) rotate(${dragX / 22}deg)` : undefined,
        transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.2, 0.9, 0.25, 1.15)',
        zIndex: 10,
      };
    }
    return {
      transform: `translateY(${position * 18}px) scale(${1 - position * 0.05})`,
      transition: 'transform 380ms cubic-bezier(0.2, 0.9, 0.25, 1.1)',
      zIndex: 10 - position,
      filter: `brightness(${1 - position * 0.2})`,
    };
  };

  const tier = card ? memoryTier(card, today) : 'new';
  const examRecall =
    card && ctx && card.lastReviewedAt ? recallOn(card, ctx.target, { today }) : null;

  const outcomes: CourseOutcome[] = done
    ? [...contexts.values()]
        .map((c) => ({
          courseId: c.id,
          code: c.code,
          exam: c.exam,
          before: baseline[c.id] ?? c.readiness,
          after: c.readiness,
          curve: forgettingCurve(c.deck, c.target, today),
          reviewedHere: queue.filter((q) => q.courseId === c.id).length,
        }))
        .sort((a, b) => b.reviewedHere - a.reviewedHere)
    : [];
  const primaryDeck = done && outcomes[0] ? (contexts.get(outcomes[0].courseId)?.deck ?? []) : [];
  const nextDate = done ? nextReviewDate(primaryDeck, today) : null;
  const nextReview = nextDate
    ? { date: nextDate, count: primaryDeck.filter((c) => c.dueDate === toDayKey(nextDate)).length }
    : null;

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flashcard-review-title"
    >
      <StudySpaceCanvas ref={canvasRef} stars={stars} flow={flow} />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.75)_100%)]"
        aria-hidden
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 flex h-full flex-col outline-none"
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4 sm:px-8 sm:pt-6">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close review session"
            className="rounded-full bg-foreground/5 p-2 text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {ctx && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-bold tracking-wide text-foreground">
                {ctx.code}
              </span>
              <span className="truncate rounded-full bg-foreground/5 px-3 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10">
                {examChip(ctx.exam)}
              </span>
            </div>
          )}

          {!done && (
            <div className="ml-auto flex items-center gap-4 sm:gap-6">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Points
                </p>
                <p
                  key={stats.points}
                  className="study-pop font-display text-xl tabular-nums text-foreground"
                >
                  {stats.points.toLocaleString()}
                </p>
              </div>
              <div className="w-28">
                <p className="flex items-center justify-between gap-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{inZone ? 'In the zone' : 'Combo'}</span>
                  <span
                    className={cn(
                      'tabular-nums',
                      stats.combo > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    ×{stats.combo}
                  </span>
                </p>
                <div
                  className={cn(
                    'mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10',
                    inZone && 'study-zone-bar',
                  )}
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-gradient-brand transition-[width] duration-500 ease-out"
                    style={{
                      width: `${flow * 100}%`,
                      boxShadow: flow > 0 ? '0 0 12px rgba(140,110,255,0.8)' : undefined,
                    }}
                  />
                </div>
              </div>
              {ctx && (
                <div className="flex items-center gap-2">
                  <RingGauge
                    variant="brand"
                    progress={ctx.readiness}
                    size={52}
                    radius={20}
                    strokeWidth={5}
                    aria-label={`Exam readiness ${pct(ctx.readiness)}`}
                  >
                    <span className="text-[11px] font-bold tabular-nums text-foreground">
                      {pct(ctx.readiness)}
                    </span>
                  </RingGauge>
                  <p className="hidden text-[10px] font-semibold uppercase leading-tight tracking-[0.16em] text-muted-foreground lg:block">
                    Exam
                    <br />
                    readiness
                  </p>
                </div>
              )}
            </div>
          )}
        </header>

        {!done && (
          <div className="px-4 pt-4 sm:px-8">
            <div className="mx-auto flex max-w-xl items-center gap-3">
              <p
                id="flashcard-review-title"
                className="shrink-0 text-xs font-semibold tabular-nums text-foreground/70"
              >
                Card {index + 1} of {queue.length}
              </p>
              <div className="flex flex-1 gap-1" aria-hidden>
                {queue.map((c, i) => (
                  <span
                    key={c.id}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-500',
                      results[c.id] === 'recalled'
                        ? 'bg-emerald-400'
                        : results[c.id] === 'lapsed'
                          ? 'bg-rose-400/70'
                          : i === index
                            ? 'animate-pulse bg-violet-500 dark:bg-violet-300'
                            : 'bg-foreground/15',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-6 sm:px-8">
          {done ? (
            <SessionRecap
              stats={stats}
              durationMs={durationMs}
              outcomes={outcomes}
              nextReview={nextReview}
              onDone={handleClose}
            />
          ) : (
            <div className="my-auto w-full max-w-xl">
              <div className="relative">
                <div
                  aria-live="polite"
                  className="pointer-events-none absolute -top-12 left-0 right-0 z-20 flex justify-center"
                >
                  {feedback && (
                    <div
                      key={feedback.id}
                      className={cn(
                        'study-float rounded-full px-4 py-1.5 text-center text-sm font-semibold shadow-lg backdrop-blur',
                        feedback.tone === 'win'
                          ? 'bg-emerald-400/15 text-emerald-800 ring-1 ring-emerald-400/50 dark:text-emerald-100 dark:ring-emerald-300/40'
                          : 'bg-rose-400/10 text-rose-800 ring-1 ring-rose-400/40 dark:text-rose-100 dark:ring-rose-300/30',
                      )}
                    >
                      {feedback.title}
                      <span className="ml-2 font-normal opacity-80">{feedback.detail}</span>
                    </div>
                  )}
                </div>

                <div
                  className="flip-card-scene relative mb-8 h-[300px] sm:h-[340px]"
                  onPointerMove={handleTilt}
                  onPointerLeave={resetTilt}
                >
                  {stack
                    .map((c, i) => ({ c, i }))
                    .reverse()
                    .map(({ c, i }) =>
                      i === 0 ? (
                        <div
                          key={c.id}
                          ref={cardRef}
                          className="absolute inset-0 cursor-grab touch-pan-y select-none outline-none active:cursor-grabbing [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-primary/70 rounded-[28px]"
                          style={cardStyle(0)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={revealed}
                          aria-label={
                            revealed
                              ? 'Flashcard, showing answer. Swipe or drag right for Good, left for Again, or tap to flip back.'
                              : 'Flashcard, showing question. Tap to reveal the answer.'
                          }
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                        >
                          <div ref={tiltRef} className="study-tilt h-full w-full">
                            <div className={cn('flip-card-inner', revealed && 'is-flipped')}>
                              <div
                                className={cn(
                                  'flip-card-face study-card-surface flex flex-col rounded-[28px] p-6 sm:p-8',
                                  inZone && 'spin-border study-zone',
                                )}
                              >
                                <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  <span>{ctx?.code ?? 'Flashcard'}</span>
                                  <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={
                                        tier === 'new'
                                          ? {
                                              boxShadow: 'inset 0 0 0 1.25px rgba(255,255,255,0.6)',
                                            }
                                          : {
                                              background: TIER_COLOR[tier],
                                              boxShadow: `0 0 10px ${TIER_COLOR[tier]}`,
                                            }
                                      }
                                    />
                                    {TIER_LABEL[tier]}
                                  </span>
                                </div>
                                <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto py-4">
                                  <p className="text-balance text-center font-display text-2xl leading-snug text-foreground sm:text-[1.75rem]">
                                    {c.front}
                                  </p>
                                </div>
                                <div className="relative z-10 flex items-end justify-between gap-3 text-xs">
                                  {examRecall === null ? (
                                    <span className="text-muted-foreground">
                                      New card · first look
                                    </span>
                                  ) : (
                                    <div className="min-w-0">
                                      <p className="text-muted-foreground">
                                        {ctx?.exam ? 'Exam-day recall' : 'Recall in a week'}{' '}
                                        <span className="font-semibold tabular-nums text-foreground">
                                          {pct(examRecall)}
                                        </span>
                                      </p>
                                      <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                                        <div
                                          className="h-full rounded-full bg-gradient-brand"
                                          style={{ width: `${examRecall * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <span className="shrink-0 text-muted-foreground/80">
                                    Tap
                                    <span className="hidden sm:inline">
                                      {' '}
                                      or <Kbd>Space</Kbd>
                                    </span>{' '}
                                    to flip
                                  </span>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  'flip-card-face flip-card-face-back study-card-surface flex flex-col rounded-[28px] p-6 sm:p-8',
                                  inZone && 'spin-border study-zone',
                                )}
                              >
                                {dragX !== 0 && (
                                  <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit]"
                                    style={{
                                      background:
                                        dragX > 0
                                          ? `rgba(140,110,255,${swipeTint * 0.18})`
                                          : `rgba(251,113,133,${swipeTint * 0.16})`,
                                      boxShadow: `inset 0 0 0 2px ${
                                        dragX > 0
                                          ? `rgba(167,139,250,${swipeTint})`
                                          : `rgba(251,113,133,${swipeTint})`
                                      }`,
                                    }}
                                  />
                                )}
                                {dragX !== 0 && (
                                  <span
                                    aria-hidden
                                    className={cn(
                                      'absolute top-6 z-20 rounded-lg border-2 px-2.5 py-0.5 text-sm font-black uppercase tracking-widest',
                                      dragX > 0
                                        ? 'left-6 -rotate-12 border-violet-500 text-violet-600 dark:border-violet-300 dark:text-violet-200'
                                        : 'right-6 rotate-12 border-rose-500 text-rose-600 dark:border-rose-300 dark:text-rose-200',
                                    )}
                                    style={{ opacity: swipeTint }}
                                  >
                                    {dragX > 0 ? 'Good' : 'Again'}
                                  </span>
                                )}
                                <p
                                  className={cn(
                                    'relative z-10 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-opacity',
                                    dragX !== 0 && 'opacity-0',
                                  )}
                                >
                                  Answer
                                </p>
                                <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto py-3 text-center">
                                  <p className="text-sm leading-relaxed text-muted-foreground">
                                    {c.front}
                                  </p>
                                  <div className="h-px w-16 bg-gradient-brand opacity-70" />
                                  <p className="text-balance font-display text-2xl leading-snug text-foreground sm:text-[1.75rem]">
                                    {c.back}
                                  </p>
                                </div>
                                <p className="relative z-10 text-center text-xs text-muted-foreground/80">
                                  <Kbd>←</Kbd> swipe left for Again · swipe right for Good{' '}
                                  <Kbd>→</Kbd>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={c.id}
                          aria-hidden
                          className="absolute inset-0"
                          style={cardStyle(i)}
                        >
                          <div className="study-card-surface study-ghost h-full w-full rounded-[28px]" />
                        </div>
                      ),
                    )}
                </div>
              </div>

              <div className="min-h-[96px]">
                {revealed ? (
                  <div className="study-rise grid grid-cols-4 gap-2 sm:gap-3">
                    {RATINGS.map(({ rating: r, label, key, className }) => {
                      const next = card ? applySM2(card, r, today).interval : 1;
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={rating}
                          onClick={() => handleRate(r)}
                          aria-label={`${label}, next review ${intervalLabel(next)}`}
                          className={cn(
                            'flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl ring-1 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40',
                            className,
                          )}
                        >
                          <span className="text-sm font-semibold">{label}</span>
                          <span className="flex items-center gap-1.5 text-[11px] opacity-70">
                            {intervalShort(next)}
                            <Kbd>{key}</Kbd>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="study-rise">
                    <p className="mb-2.5 text-center text-xs text-muted-foreground">
                      Gut call before you flip — do you know it?
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {CONFIDENCE.map(({ value, label, key }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => flip(value)}
                          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-foreground/5 text-sm font-semibold text-foreground/85 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:bg-foreground/10 hover:text-foreground active:translate-y-0"
                        >
                          {label}
                          <Kbd>{key}</Kbd>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
