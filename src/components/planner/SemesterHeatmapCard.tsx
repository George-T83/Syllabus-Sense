'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { computeSemesterHeatmap, type SemesterHeatmapDay } from '@/lib/planner/semesterHeatmap';
import { WORKLOAD_SWATCH_CLASS } from '@/lib/workload/uiClasses';
import { parseDayKey } from '@/lib/calendar/dates';
import { cn } from '@/lib/utils';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short' });
const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

// GitHub's own contribution graph only labels every other weekday row (Mon,
// Wed, Fri) - a label on all 7 rows crowds the narrow gutter this grid has
// to share with the cells themselves.
const ROW_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

/**
 * A GitHub-contribution-style calendar heatmap spanning every due date the
 * student has on record, colored with the same low/medium/high/critical
 * scale as the rest of the workload UI. Distinct from
 * WorkloadOverviewDashboard above it, which forecasts the next 7 days - this
 * answers "when in the whole semester am I going to be slammed", visible
 * before those weeks actually arrive.
 */
export function SemesterHeatmapCard() {
  const { state } = useAppState();
  const days = useMemo(() => computeSemesterHeatmap(state.scheduleItems), [state.scheduleItems]);

  if (days.length === 0) return null;

  // Pad the front so the first real day lands in its correct weekday row
  // (0 = Sunday) of a GitHub-style 7-row, weeks-as-columns grid.
  const leadingBlanks = parseDayKey(days[0].dateKey).getDay();
  const cells: (SemesterHeatmapDay | null)[] = [...Array(leadingBlanks).fill(null), ...days];

  // Month labels: one per calendar month that appears in range, positioned
  // above the week-column where that month's first visible day falls.
  const rawMonthLabels: { label: string; columnIndex: number }[] = [];
  let lastMonth = '';
  cells.forEach((cell, i) => {
    if (!cell) return;
    const columnIndex = Math.floor(i / 7);
    const month = MONTH_FORMATTER.format(parseDayKey(cell.dateKey));
    if (month !== lastMonth) {
      rawMonthLabels.push({ label: month, columnIndex });
      lastMonth = month;
    }
  });
  // A month that only has a sliver of columns in view before the next one
  // starts (e.g. a term beginning mid-August) doesn't have room for its own
  // label without overlapping the next - drop it rather than render two
  // labels on top of each other.
  const MIN_LABEL_GAP_COLUMNS = 2;
  const monthLabels = rawMonthLabels.filter((entry, i) => {
    const next = rawMonthLabels[i + 1];
    return !next || next.columnIndex - entry.columnIndex >= MIN_LABEL_GAP_COLUMNS;
  });
  const columnCount = Math.ceil(cells.length / 7);

  const totalHours = days.reduce((sum, d) => sum + d.hours, 0);

  return (
    <Card className="rounded-2xl p-6" data-testid="semester-heatmap-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {totalHours.toFixed(0)}h of work due this semester
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every due date on record, at a glance - spot the heavy weeks before they arrive.
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex gap-2">
          <div
            className="grid shrink-0 text-[10px] text-muted-foreground"
            style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))', rowGap: '0.25rem' }}
          >
            {Array.from({ length: 7 }, (_, row) => (
              <span key={row} className="flex h-3 items-center">
                {ROW_LABELS[row] ?? ''}
              </span>
            ))}
          </div>

          <div
            className="relative grid w-full min-w-0 flex-1 gap-1 pt-4"
            style={{
              gridTemplateRows: 'repeat(7, 0.75rem)',
              gridAutoFlow: 'column',
              // A floor on column width (not just `1fr`) keeps cells from
              // going illegibly thin over a full year's worth of weeks -
              // below that floor the card scrolls horizontally instead.
              // Above it, columns stretch to fill the card's full width
              // rather than shrinking to their own natural content size.
              gridTemplateColumns: `repeat(${columnCount}, minmax(0.5rem, 1fr))`,
            }}
          >
            {monthLabels.map(({ label, columnIndex }) => (
              <span
                key={`${label}-${columnIndex}`}
                className="absolute top-0 text-[10px] font-medium text-muted-foreground"
                style={{ left: `${(columnIndex / columnCount) * 100}%` }}
              >
                {label}
              </span>
            ))}
            {cells.map((cell, i) =>
              cell ? (
                <Link
                  key={cell.dateKey}
                  href={`/calendar?date=${cell.dateKey}`}
                  title={`${DAY_FORMATTER.format(parseDayKey(cell.dateKey))} · ${cell.hours}h due`}
                  aria-label={`Open ${DAY_FORMATTER.format(parseDayKey(cell.dateKey))} in Calendar - ${cell.hours}h due`}
                  className={cn(
                    'h-full w-full rounded-[2px] transition-transform hover:scale-125 hover:ring-1 hover:ring-foreground/40 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40',
                    cell.hours > 0 ? WORKLOAD_SWATCH_CLASS[cell.level] : 'bg-border',
                  )}
                />
              ) : (
                <div key={`blank-${i}`} className="h-full w-full rounded-[2px] bg-border" />
              ),
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Click a day to open it in Calendar</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span>Less</span>
            <span className="h-2.5 w-2.5 rounded-[2px] bg-border" />
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', WORKLOAD_SWATCH_CLASS.low)} />
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', WORKLOAD_SWATCH_CLASS.medium)} />
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', WORKLOAD_SWATCH_CLASS.high)} />
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', WORKLOAD_SWATCH_CLASS.critical)} />
            <span>More</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
