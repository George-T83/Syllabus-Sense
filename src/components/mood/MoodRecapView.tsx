'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { useAppState } from '@/context/AppStateContext';
import { CardActionButton } from '@/components/ui/CardAction';
import { TermFormModal } from '@/components/terms/TermFormModal';
import { buildTermGrid } from '@/lib/mood/termGrid';
import { suggestTermLabel } from '@/lib/terms/standardTerms';
import { planTermMigration } from '@/lib/terms/termMigration';
import { resolveActiveTerm, termForSingleView } from '@/lib/terms/termResolve';
import {
  computeMoodStreak,
  computeAverageMood,
  computeMoodByWorkloadLevel,
  computeMoodTrend,
  computeBestAndWorstDay,
} from '@/lib/mood/moodStats';
import { MOOD_OPTIONS, MOOD_SWATCH_CLASS, getMoodOption } from '@/lib/mood/moodScale';
import { WORKLOAD_RAW_COLOR } from '@/lib/workload/uiClasses';
import { parseDayKey, toDayKey } from '@/lib/calendar/dates';
import { cn } from '@/lib/utils';
import type { WorkloadLevel } from '@/types/schedule';
import type { MoodValue } from '@/types/mood';
import {
  SHORT_DATE_FORMATTER,
  WEEKDAY_SHORT_DATE_FORMATTER as FULL_DATE_FORMATTER,
  MONTH_SHORT_FORMATTER as MONTH_FORMATTER,
} from '@/lib/dateFormatters';

// Same GitHub-contribution-graph convention as the semester heatmap: only
// every other weekday row gets a label, so the gutter doesn't crowd the
// cells themselves.
/** Each day is a 24px square; the gap between squares is Tailwind's `gap-1`. */
const CELL_PX = 24;
const CELL_GAP_PX = 4;

const ROW_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

const WORKLOAD_LEVEL_LABEL: Record<WorkloadLevel, string> = {
  low: 'Light',
  medium: 'Moderate',
  high: 'Heavy',
  critical: 'Extreme',
};

/** Recharts' shared tooltip look, reused by both charts below instead of
 * two copies of the same object literal. */
const CHART_TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

export function MoodRecapView() {
  const router = useRouter();
  const { state } = useAppState();
  const entries = state.moodEntries;

  const streak = computeMoodStreak(entries);
  const average = computeAverageMood(entries);
  const trend = useMemo(() => computeMoodTrend(entries), [entries]);
  const byWorkload = useMemo(
    () => computeMoodByWorkloadLevel(entries, state.scheduleItems),
    [entries, state.scheduleItems],
  );
  const { best, worst } = useMemo(() => computeBestAndWorstDay(entries), [entries]);

  // The grid always draws one term's whole run, its first day to its last,
  // from the term object the student stored (see types/term.ts). Never from
  // due dates or check-ins, so a student with one check-in still sees the
  // full term.
  const todayKey = toDayKey(new Date());
  const term = useMemo(
    () =>
      termForSingleView(
        resolveActiveTerm(state.selectedTerm, state.courses, state.terms),
        state.terms,
        todayKey,
      ),
    [state.selectedTerm, state.courses, state.terms, todayKey],
  );
  // Course terms still waiting for their dates (the student closed the
  // prompt on load), offered here so the grid is never a dead end.
  const undatedLabel = useMemo(
    () => planTermMigration(state.courses, state.terms).unknownLabels[0],
    [state.courses, state.terms],
  );
  const [termModal, setTermModal] = useState<'new' | 'edit' | null>(null);

  const grid = useMemo(() => {
    if (!term) return { cells: [], outsideCount: 0 };
    const moodByDay = new Map(trend.map((p) => [p.dateKey, p.mood as MoodValue]));
    return buildTermGrid(term, moodByDay, todayKey);
  }, [term, trend, todayKey]);
  const calendarCells = grid.cells;
  const columnCount = Math.ceil(calendarCells.length / 7);

  // A semester wider than the card scrolls sideways; start with today in view
  // rather than at the first week.
  const hasEntries = entries.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const todayLinkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    const today = todayRef.current ?? todayLinkRef.current;
    if (!scroller || !today || scroller.scrollWidth <= scroller.clientWidth) return;
    const offsetInScroller =
      today.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left +
      scroller.scrollLeft;
    scroller.scrollLeft = Math.max(
      0,
      offsetInScroller - scroller.clientWidth / 2 + today.offsetWidth / 2,
    );
  }, [term, hasEntries]);

  // Month labels, positioned above the week-column where that month's first
  // visible cell falls - identical logic to the semester heatmap, so both
  // grids read the same way.
  const monthLabels = useMemo(() => {
    const raw: { label: string; columnIndex: number }[] = [];
    let lastMonth = '';
    calendarCells.forEach((cell, i) => {
      if (!cell.dateKey) return;
      const columnIndex = Math.floor(i / 7);
      const month = MONTH_FORMATTER.format(parseDayKey(cell.dateKey));
      if (month !== lastMonth) {
        raw.push({ label: month, columnIndex });
        lastMonth = month;
      }
    });
    const MIN_LABEL_GAP_COLUMNS = 2;
    return raw.filter((entry, i) => {
      const next = raw[i + 1];
      return !next || next.columnIndex - entry.columnIndex >= MIN_LABEL_GAP_COLUMNS;
    });
  }, [calendarCells]);

  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl p-6">
        <EmptyState
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          title="No check-ins yet"
          description="Tap a mood on your dashboard each day - your recap builds up from there."
          action={{
            label: 'Go to Dashboard',
            onClick: () => router.push('/dashboard'),
          }}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Check-ins" value={String(entries.length)} />
        <StatTile
          label="Average mood"
          value={average ? getMoodOption(Math.round(average) as MoodValue).emoji : '—'}
          sub={average ? average.toFixed(1) : undefined}
        />
        <StatTile label="Current streak" value={`${streak}d`} />
        <StatTile
          label="Best day"
          value={best ? getMoodOption(best.mood as MoodValue).emoji : '—'}
          sub={best ? SHORT_DATE_FORMATTER.format(parseDayKey(best.dateKey)) : undefined}
        />
      </div>

      <Card className="rounded-2xl p-6">
        <h2 className="text-base font-semibold text-foreground">Your mood over time</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Every check-in, in order.</p>
        <div className="mt-4" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trend.map((p) => ({
                ...p,
                label: SHORT_DATE_FORMATTER.format(parseDayKey(p.dateKey)),
              }))}
            >
              <defs>
                <linearGradient id="moodTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={WORKLOAD_RAW_COLOR.low} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={WORKLOAD_RAW_COLOR.low} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={[0.5, 4.5]}
                ticks={[1, 2, 3, 4]}
                tickFormatter={(v: number) => MOOD_OPTIONS[v - 1]?.emoji ?? ''}
                width={28}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 14 }}
              />
              <Tooltip
                formatter={(value) => {
                  const mood = getMoodOption(Number(value) as MoodValue);
                  return [`${mood.emoji} ${mood.label}`, 'Mood'];
                }}
                contentStyle={CHART_TOOLTIP_STYLE}
              />
              <Area
                type="monotone"
                dataKey="mood"
                stroke={WORKLOAD_RAW_COLOR.low}
                strokeWidth={2}
                fill="url(#moodTrendFill)"
                dot={{ r: 3, fill: WORKLOAD_RAW_COLOR.low, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="rounded-2xl p-6">
        <h2 className="text-base font-semibold text-foreground">Mood by workload level</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Does a heavier day actually feel worse? The colors match your semester heatmap.
        </p>
        <div className="mt-4" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byWorkload.map((b) => ({
                ...b,
                label: WORKLOAD_LEVEL_LABEL[b.level],
                // Recharts treats a `null` dataKey value as "nothing to
                // render" for a category - no bar, and no `background`
                // hit-area either - so a zero-count bucket became
                // completely unhoverable (the "No check-ins yet" message
                // below never got a chance to show). A numeric 0 still
                // renders (as a zero-height bar plus its hoverable
                // background); `count` is what actually drives the
                // zero-vs-real-zero-average distinction in both the
                // formatter and the fill opacity below.
                averageMood: b.averageMood ?? 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tickFormatter={(v: number) => (v === 0 ? '' : (MOOD_OPTIONS[v - 1]?.emoji ?? ''))}
                width={28}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 14 }}
              />
              <Tooltip
                formatter={(value, _name, ctx) => {
                  const count = (ctx.payload as { count: number }).count;
                  if (!count) return ['No check-ins yet', ''];
                  const numeric = Number(value);
                  const mood = getMoodOption(Math.round(numeric) as MoodValue);
                  return [
                    `${mood.emoji} ${numeric.toFixed(1)} avg (${count} day${count === 1 ? '' : 's'})`,
                    'Mood',
                  ];
                }}
                contentStyle={CHART_TOOLTIP_STYLE}
                cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }}
              />
              <Bar
                dataKey="averageMood"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                // A bucket with zero check-ins has a zero-height bar - nothing
                // there to hover, so the "No check-ins yet" message the
                // formatter above already writes for that case never had a
                // chance to show. `background` gives every category a full-
                // height (invisible) hit area regardless of its bar's value,
                // so hovering an empty bucket's column still activates the
                // tooltip.
                background={{ fill: 'transparent' }}
              >
                {byWorkload.map((b) => (
                  <Cell
                    key={b.level}
                    fill={WORKLOAD_RAW_COLOR[b.level]}
                    fillOpacity={b.count ? 1 : 0.15}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Your check-in history</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Click a day to open it in Calendar and see what was going on.
            </p>
          </div>
          {term && (
            <CardActionButton variant="ghost" onClick={() => setTermModal('edit')}>
              Edit term
            </CardActionButton>
          )}
        </div>

        {term && (
          <p className="mt-3 text-sm font-medium text-foreground" data-testid="term-span">
            {term.label} · {SHORT_DATE_FORMATTER.format(parseDayKey(term.startDate))} –{' '}
            {SHORT_DATE_FORMATTER.format(parseDayKey(term.endDate))}
          </p>
        )}

        {!term && (
          <div className="mt-3 space-y-3" data-testid="term-missing">
            <p className="text-sm text-foreground">
              {undatedLabel
                ? `${undatedLabel} doesn’t have a first and last day yet, so there is no grid to draw.`
                : 'The grid shows a whole term, first day to last. Create your term to see it.'}
            </p>
            <CardActionButton variant="solid" withPlus onClick={() => setTermModal('new')}>
              {undatedLabel ? `Set dates for ${undatedLabel}` : 'Create a term'}
            </CardActionButton>
          </div>
        )}

        {term && (
          <>
            <div className="mx-auto mt-4 flex w-max max-w-full gap-2">
              <div
                className="grid shrink-0 gap-1 pt-4 text-xs text-muted-foreground"
                style={{ gridTemplateRows: `repeat(7, ${CELL_PX}px)` }}
              >
                {Array.from({ length: 7 }, (_, row) => (
                  <span key={row} className="flex items-center">
                    {ROW_LABELS[row] ?? ''}
                  </span>
                ))}
              </div>

              {/* The weekday labels stay put; only the weeks scroll. */}
              <div ref={scrollRef} className="min-w-0 overflow-x-auto pb-1">
                {/* Every day is a fixed 24px square (7 rows, one column per
                 * week), so the grid is the same size however much of the
                 * semester has check-ins, and a long semester scrolls
                 * sideways instead of shrinking the squares. */}
                <div
                  className="relative grid gap-1 pt-4"
                  data-testid="checkin-grid"
                  style={{
                    gridTemplateRows: `repeat(7, ${CELL_PX}px)`,
                    gridAutoFlow: 'column',
                    gridTemplateColumns: `repeat(${columnCount}, ${CELL_PX}px)`,
                  }}
                >
                  {monthLabels.map(({ label, columnIndex }) => (
                    <span
                      key={`${label}-${columnIndex}`}
                      className="absolute top-0 text-xs font-medium text-muted-foreground"
                      style={{ left: columnIndex * (CELL_PX + CELL_GAP_PX) }}
                    >
                      {label}
                    </span>
                  ))}
                  {calendarCells.map((cell, i) => {
                    if (cell.dateKey && cell.mood) {
                      return (
                        <Link
                          key={cell.dateKey}
                          ref={cell.phase === 'today' ? todayLinkRef : undefined}
                          href={`/calendar?date=${cell.dateKey}`}
                          title={`${FULL_DATE_FORMATTER.format(parseDayKey(cell.dateKey))} · ${getMoodOption(cell.mood).label}`}
                          aria-label={`Open ${FULL_DATE_FORMATTER.format(parseDayKey(cell.dateKey))} in Calendar - felt ${getMoodOption(cell.mood).label.toLowerCase()}`}
                          className={cn(
                            'h-6 w-6 rounded-[2px] transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-foreground/40 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40',
                            MOOD_SWATCH_CLASS[cell.mood],
                          )}
                        />
                      );
                    }
                    // Padding cells before the first day draw nothing. A day
                    // still to come is an outline, so a full semester does
                    // not read as a wall of missed check-ins; a past day
                    // with no check-in keeps the filled gray; today, until
                    // checked in, is ringed.
                    const phaseClass = !cell.dateKey
                      ? ''
                      : cell.phase === 'future'
                        ? 'border border-dashed border-muted-foreground/30'
                        : cell.phase === 'today'
                          ? 'bg-muted-foreground/15 ring-2 ring-primary/70'
                          : 'bg-muted-foreground/15';
                    return (
                      <div
                        key={cell.dateKey || `blank-${i}`}
                        ref={cell.phase === 'today' && cell.dateKey ? todayRef : undefined}
                        data-phase={cell.dateKey ? cell.phase : undefined}
                        className={cn('h-6 w-6 rounded-[2px]', phaseClass)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            {grid.outsideCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {grid.outsideCount} {grid.outsideCount === 1 ? 'check-in falls' : 'check-ins fall'}{' '}
                outside these dates and {grid.outsideCount === 1 ? "isn't" : "aren't"} shown.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-muted-foreground/15" />
                  No check-in
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-muted-foreground/40" />
                  Upcoming
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Rough</span>
                {MOOD_OPTIONS.map((o) => (
                  <span
                    key={o.value}
                    className={cn('h-2.5 w-2.5 rounded-[2px]', MOOD_SWATCH_CLASS[o.value])}
                  />
                ))}
                <span>Great</span>
              </div>
            </div>
          </>
        )}
      </Card>

      <TermFormModal
        open={termModal !== null}
        onClose={() => setTermModal(null)}
        initialTerm={termModal === 'edit' ? (term ?? undefined) : undefined}
        suggestedLabel={
          termModal === 'new' ? (undatedLabel ?? suggestTermLabel(todayKey)) : undefined
        }
      />

      {(best || worst) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {best && (
            <Card className="rounded-2xl border-load-low/30 bg-load-low/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-load-low">
                Your best day
              </p>
              <p className="mt-1 text-3xl">{getMoodOption(best.mood as MoodValue).emoji}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {FULL_DATE_FORMATTER.format(parseDayKey(best.dateKey))}
              </p>
            </Card>
          )}
          {worst && (
            <Card className="rounded-2xl border-load-critical/30 bg-load-critical/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-load-critical">
                Your toughest day
              </p>
              <p className="mt-1 text-3xl">{getMoodOption(worst.mood as MoodValue).emoji}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {FULL_DATE_FORMATTER.format(parseDayKey(worst.dateKey))}
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
