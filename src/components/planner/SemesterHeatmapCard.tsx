'use client';

import { useMemo } from 'react';
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
  const monthLabels: { label: string; columnIndex: number }[] = [];
  let lastMonth = '';
  cells.forEach((cell, i) => {
    if (!cell) return;
    const columnIndex = Math.floor(i / 7);
    const month = MONTH_FORMATTER.format(parseDayKey(cell.dateKey));
    if (month !== lastMonth) {
      monthLabels.push({ label: month, columnIndex });
      lastMonth = month;
    }
  });
  const columnCount = Math.ceil(cells.length / 7);

  return (
    <Card className="rounded-2xl p-6" data-testid="semester-heatmap-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Semester load</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every due date on record, at a glance - spot the heavy weeks before they arrive.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Lighter</span>
          <span className="h-2.5 w-2.5 rounded-sm bg-muted/50" />
          <span className={cn('h-2.5 w-2.5 rounded-sm', WORKLOAD_SWATCH_CLASS.low)} />
          <span className={cn('h-2.5 w-2.5 rounded-sm', WORKLOAD_SWATCH_CLASS.medium)} />
          <span className={cn('h-2.5 w-2.5 rounded-sm', WORKLOAD_SWATCH_CLASS.high)} />
          <span className={cn('h-2.5 w-2.5 rounded-sm', WORKLOAD_SWATCH_CLASS.critical)} />
          <span>Heavier</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div
          className="relative grid gap-1"
          style={{
            gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
            gridAutoFlow: 'column',
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }}
        >
          {monthLabels.map(({ label, columnIndex }) => (
            <span
              key={`${label}-${columnIndex}`}
              className="absolute -top-4 text-[10px] font-medium text-muted-foreground"
              style={{ left: `calc(${columnIndex} * (0.75rem + 0.25rem))` }}
            >
              {label}
            </span>
          ))}
          {cells.map((cell, i) =>
            cell ? (
              <div
                key={cell.dateKey}
                title={`${DAY_FORMATTER.format(parseDayKey(cell.dateKey))} · ${cell.hours}h due`}
                className={cn(
                  'h-3 w-3 rounded-sm',
                  cell.hours > 0 ? WORKLOAD_SWATCH_CLASS[cell.level] : 'bg-muted/50',
                )}
              />
            ) : (
              <div key={`blank-${i}`} className="h-3 w-3" />
            ),
          )}
        </div>
      </div>
    </Card>
  );
}
