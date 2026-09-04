'use client';

import { useMemo } from 'react';
import Link from 'next/link';
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
import { useAppState } from '@/context/AppStateContext';
import {
  computeMoodStreak,
  computeAverageMood,
  computeMoodByWorkloadLevel,
  computeMoodTrend,
  computeBestAndWorstDay,
} from '@/lib/mood/moodStats';
import { MOOD_OPTIONS, MOOD_SWATCH_CLASS, getMoodOption } from '@/lib/mood/moodScale';
import { parseDayKey } from '@/lib/calendar/dates';
import { cn } from '@/lib/utils';
import type { WorkloadLevel } from '@/types/schedule';
import type { MoodValue } from '@/types/mood';

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const WORKLOAD_LEVEL_LABEL: Record<WorkloadLevel, string> = {
  low: 'Light',
  medium: 'Moderate',
  high: 'Heavy',
  critical: 'Extreme',
};

/** Same 4-step palette as MOOD_SWATCH_CLASS/WORKLOAD_SWATCH_CLASS, as raw
 * CSS color strings - recharts draws its own SVG and can't consume
 * Tailwind's utility classes, but reading the same `--load-*` custom
 * properties keeps every chart on this page and the workload heatmap
 * drawing from one shared palette. */
const CHART_COLOR: Record<WorkloadLevel, string> = {
  low: 'hsl(var(--load-low))',
  medium: 'hsl(var(--load-medium))',
  high: 'hsl(var(--load-high))',
  critical: 'hsl(var(--load-critical))',
};
function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export function MoodRecapView() {
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

  const calendarCells = useMemo(() => {
    if (trend.length === 0) return [];
    const byDate = new Map(trend.map((p) => [p.dateKey, p.mood]));
    const start = parseDayKey(trend[0].dateKey);
    const end = parseDayKey(trend[trend.length - 1].dateKey);
    const leadingBlanks = start.getDay();
    const cells: { dateKey: string; mood: MoodValue | null }[] = Array.from(
      { length: leadingBlanks },
      () => ({ dateKey: '', mood: null }),
    );
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const dateKey = cursor.toISOString().slice(0, 10);
      cells.push({ dateKey, mood: (byDate.get(dateKey) as MoodValue | undefined) ?? null });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [trend]);
  const columnCount = Math.ceil(calendarCells.length / 7);

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
            onClick: () => (window.location.href = '/dashboard'),
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
                  <stop offset="5%" stopColor="hsl(var(--load-low))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--load-low))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={[1, 4]}
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
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="mood"
                stroke="hsl(var(--load-low))"
                strokeWidth={2}
                fill="url(#moodTrendFill)"
                dot={{ r: 3, fill: 'hsl(var(--load-low))', strokeWidth: 0 }}
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
              data={byWorkload.map((b) => ({ ...b, label: WORKLOAD_LEVEL_LABEL[b.level] }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="averageMood" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {byWorkload.map((b) => (
                  <Cell
                    key={b.level}
                    fill={CHART_COLOR[b.level]}
                    fillOpacity={b.count ? 1 : 0.15}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="rounded-2xl p-6">
        <h2 className="text-base font-semibold text-foreground">Your check-in history</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Click a day to open it in Calendar and see what was going on.
        </p>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-full justify-center">
            {/* Same square-by-construction trick as the semester heatmap:
             * a fixed-height parent divides evenly into 7 `1fr` row tracks,
             * every cell stretches to that row height and carries
             * `aspect-square`, and the `auto` column tracks size themselves
             * to match - so the grid fills the card's height and stays
             * square instead of shrinking to tiny fixed-size squares. */}
            <div
              className="grid gap-1"
              style={{
                height: '10rem',
                gridTemplateRows: 'repeat(7, 1fr)',
                gridAutoFlow: 'column',
                gridTemplateColumns: `repeat(${columnCount}, auto)`,
              }}
            >
              {calendarCells.map((cell, i) =>
                cell.dateKey && cell.mood ? (
                  <Link
                    key={cell.dateKey}
                    href={`/calendar?date=${cell.dateKey}`}
                    title={`${FULL_DATE_FORMATTER.format(parseDayKey(cell.dateKey))} · ${getMoodOption(cell.mood).label}`}
                    aria-label={`Open ${FULL_DATE_FORMATTER.format(parseDayKey(cell.dateKey))} in Calendar - felt ${getMoodOption(cell.mood).label.toLowerCase()}`}
                    className={cn(
                      'aspect-square h-full rounded-[2px] transition-transform hover:scale-125 hover:ring-1 hover:ring-foreground/40 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40',
                      MOOD_SWATCH_CLASS[cell.mood],
                    )}
                  />
                ) : (
                  <div
                    key={cell.dateKey || `blank-${i}`}
                    className="aspect-square h-full rounded-[2px] bg-border"
                  />
                ),
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>Rough</span>
          {MOOD_OPTIONS.map((o) => (
            <span
              key={o.value}
              className={cn('h-2.5 w-2.5 rounded-[2px]', MOOD_SWATCH_CLASS[o.value])}
            />
          ))}
          <span>Great</span>
        </div>
      </Card>

      {(best || worst) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {best && (
            <Card className="rounded-2xl border-load-low/30 bg-load-low/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-load-low">
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-load-critical">
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
