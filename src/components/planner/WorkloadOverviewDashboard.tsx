'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import {
  calculateWorkloadBreakdown,
  type DailyWorkloadDay,
  type WorkloadIntensity,
} from '@/lib/planner/projectChunker';
import { ProjectChunkerModal } from './ProjectChunkerModal';
import { updateScheduleItem } from '@/lib/firestore/scheduleItems';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { toLocalDateStr } from '@/lib/planner/projectChunker';
import {
  WORKLOAD_BADGE_CLASS,
  WORKLOAD_SWATCH_CLASS,
  WORKLOAD_TEXT_CLASS,
  WORKLOAD_GLOW_CLASS,
} from '@/lib/workload';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

// This dashboard's "how busy is this day" scale comes from the chunker's own
// light/moderate/heavy buckets (calculateWorkloadBreakdown), which is a
// coarser 3-tier signal than the shared WorkloadLevel used elsewhere (Month
// Calendar, Smart Planner). Rather than inventing a one-off color palette for
// it, map each bucket onto the nearest shared WorkloadLevel so the same
// low/medium/critical tokens - and their light/dark handling - are reused
// here too.
const INTENSITY_TO_LEVEL: Record<WorkloadIntensity, WorkloadLevel> = {
  light: 'low',
  moderate: 'medium',
  heavy: 'critical',
};

export interface WorkloadOverviewDashboardProps {
  scheduleItems?: ScheduleItem[];
  onToggleComplete?: (id: string) => void;
  onShiftDate?: (id: string, newDate: string) => void;
  selectedDate?: string;
  referenceDate?: Date | string;
}

export function WorkloadOverviewDashboard({
  scheduleItems,
  onToggleComplete,
  onShiftDate,
  selectedDate,
  referenceDate,
}: WorkloadOverviewDashboardProps = {}) {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const [chunkerOpen, setChunkerOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(selectedDate ?? null);

  const itemsToUse = scheduleItems ?? state.scheduleItems;
  const refDateToUse = useMemo(() => {
    return referenceDate
      ? typeof referenceDate === 'string'
        ? new Date(referenceDate)
        : referenceDate
      : new Date();
  }, [referenceDate]);

  const breakdown = useMemo(() => {
    return calculateWorkloadBreakdown(itemsToUse, [], refDateToUse);
  }, [itemsToUse, refDateToUse]);

  const activeDay: DailyWorkloadDay = useMemo(() => {
    if (selectedDayDate) {
      const found = breakdown.next7Days.find((d) => d.dateStr === selectedDayDate);
      if (found) return found;
    }
    return breakdown.today;
  }, [selectedDayDate, breakdown]);

  const activeDayHours = (activeDay.totalMinutes / 60).toFixed(1);

  // Forecast bar widths are relative to the busiest of the visible 7 days,
  // not an absolute hour scale - so the shape of the week reads clearly
  // whether it's a light syllabus-free week or exam season. Floored at 4%
  // so a genuinely empty day still shows a sliver rather than nothing.
  const maxMinutes = useMemo(
    () => Math.max(...breakdown.next7Days.map((d) => d.totalMinutes), 1),
    [breakdown.next7Days],
  );

  // The Workload Load card's Neon Edge glow escalates with how heavy the
  // inspected day actually is - a rollover/overdue task forces it to the
  // loudest (critical) tier regardless of computed intensity, since an
  // overdue item is urgent no matter how few hours it's estimated at.
  const hasRollover = activeDay.items.some((item) => item.isRollover);
  const glowLevel: WorkloadLevel = hasRollover
    ? 'critical'
    : INTENSITY_TO_LEVEL[activeDay.intensity];

  const handleToggleTask = async (taskId: string) => {
    if (onToggleComplete) {
      onToggleComplete(taskId);
      return;
    }
    if (!user) return;
    const task = itemsToUse.find((i) => i.id === taskId);
    if (!task) return;

    try {
      const updatedItem: ScheduleItem = { ...task, completed: !task.completed };
      await updateScheduleItem(user.uid, task, updatedItem, dispatch);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleShiftTaskDate = async (taskId: string, newDateStr: string) => {
    if (onShiftDate) {
      onShiftDate(taskId, newDateStr);
      return;
    }
    if (!user) return;
    const task = itemsToUse.find((i) => i.id === taskId);
    if (!task) return;

    try {
      const updatedItem: ScheduleItem = { ...task, dueDate: newDateStr };
      await updateScheduleItem(user.uid, task, updatedItem, dispatch);
    } catch (err) {
      console.error('Failed to shift task date:', err);
    }
  };

  const handleQuickShift = (taskId: string, currentDayStr: string, offsetDays: number) => {
    const [y, m, d] = currentDayStr.split('-').map(Number);
    const target = new Date(y, m - 1, d + offsetDays);
    handleShiftTaskDate(taskId, toLocalDateStr(target));
  };

  return (
    <div className="space-y-6">
      {/* Header bar with Chunk Project/Exam Action */}
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              📊 Daily &amp; Weekly Workload Center
            </span>
            {breakdown.rolledOverCount > 0 && (
              <span className="rounded-full border border-load-critical/30 bg-load-critical/10 px-2.5 py-1 text-xs font-bold text-load-critical">
                ⚠️ {breakdown.rolledOverCount} Rollover{' '}
                {breakdown.rolledOverCount === 1 ? 'Task' : 'Tasks'}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-xl font-bold text-foreground">
            Academic Workload &amp; Pace Advisor
          </h2>
          <p className="text-xs text-muted-foreground">
            Track daily study load, monitor weekly cognitive demand, and split large final projects
            or exams into bite-sized tasks.
          </p>
        </div>

        <button
          onClick={() => setChunkerOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all hover:scale-[1.02] hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Divide Project/Exam into Bite Chunks</span>
        </button>
      </Card>

      {/* Grid: Day Details & Workload Load + 7-Day Forecast Grid. Stacks
          full-width up through `lg` (1024px) and only splits into columns
          at `xl` (1280px) - at `lg` a 1/3-width Workload Load card is too
          narrow for its own header badge, stat, and the task list's date-
          shifter row to sit comfortably, so the extra headroom matters more
          than an earlier-triggering two-column layout. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Selected Day Workload Meter & Task Inspector - Neon Edge glow
            escalates with glowLevel (low = calm brand violet and still;
            medium/high/critical progress through amber/orange/red and
            breathe), so a genuinely heavy or overdue day is visibly louder
            than a merely busy one instead of every non-quiet day getting
            an identical fixed "urgent" treatment. */}
        <Card className={cn('xl:col-span-1 p-5', WORKLOAD_GLOW_CLASS[glowLevel])}>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border p-0 pb-5">
            <div>
              <CardTitle>Workload Load</CardTitle>
              {/* "Today" reads as a suffix on the date rather than its own
                  floating badge - two differently-styled pills stacked on
                  top of each other read as clutter, not information. */}
              <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                <span>
                  {activeDay.dayName}, {activeDay.formattedDate}
                </span>
                {activeDay.dateStr === breakdown.today.dateStr && (
                  <span className="inline-flex items-center gap-1 font-bold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Today
                  </span>
                )}
              </CardDescription>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize',
                WORKLOAD_BADGE_CLASS[INTENSITY_TO_LEVEL[activeDay.intensity]],
              )}
            >
              {activeDay.intensity === 'heavy' ? '⚠️ Heavy Peak' : `${activeDay.intensity} Pace`}
            </span>
          </CardHeader>

          <CardContent className="p-0 pt-5 space-y-4">
            <div className="border-b border-border/50 pb-4">
              <span className="block text-3xl font-extrabold text-foreground">
                {activeDayHours} hrs
              </span>
              <span className="mt-2 block text-xs font-semibold text-muted-foreground">
                total scheduled study load
              </span>
            </div>

            {/* Task list for selected day with manual date shifter */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Bite-Sized Tasks ({activeDay.items.length})
              </h4>
              {activeDay.items.length === 0 ? (
                <p className="text-xs italic text-muted-foreground py-2">
                  No tasks scheduled for this day.
                </p>
              ) : (
                <ul className="space-y-2.5 max-h-64 overflow-y-auto overflow-x-hidden pr-1">
                  {activeDay.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-xl border p-2.5 text-xs transition-colors',
                        item.completed
                          ? 'border-load-low/30 bg-load-low/5 opacity-75'
                          : item.isRollover
                            ? 'border-destructive/40 bg-destructive/10'
                            : 'border-border/60 bg-background/60 hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={!!item.completed}
                            onChange={() => handleToggleTask(item.id)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span
                            className={cn(
                              'font-medium text-foreground truncate',
                              item.completed && 'line-through text-muted-foreground',
                            )}
                          >
                            {item.title}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {item.durationMinutes}m
                        </span>
                      </div>

                      {/* Manual Date Shift Control with Date Picker & Quick-Shift Controls.
                       * Stacked (label above controls, controls free to wrap) rather
                       * than forced onto one line - a native <input type="date"> has a
                       * browser-enforced minimum width that doesn't shrink, so packing
                       * it alongside the quick-shift buttons on a single row overflowed
                       * this card's narrow column and forced a second, horizontal
                       * scrollbar on the already vertically-scrolling list. */}
                      {!item.completed && (
                        <div className="flex flex-col gap-1.5 border-t border-border/30 pt-1.5 text-[10px] text-muted-foreground">
                          <span>Move to another day:</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                title="Shift back 1 day"
                                onClick={() => handleQuickShift(item.id, activeDay.dateStr, -1)}
                                className="rounded border border-border px-1 py-0.5 text-[9px] font-semibold hover:bg-accent"
                              >
                                -1d
                              </button>
                              <button
                                type="button"
                                title="Shift to today"
                                onClick={() =>
                                  handleShiftTaskDate(item.id, breakdown.today.dateStr)
                                }
                                className="rounded border border-border px-1 py-0.5 text-[9px] font-semibold hover:bg-accent"
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                title="Shift ahead 1 day"
                                onClick={() => handleQuickShift(item.id, activeDay.dateStr, 1)}
                                className="rounded border border-border px-1 py-0.5 text-[9px] font-semibold hover:bg-accent"
                              >
                                +1d
                              </button>
                            </div>
                            <input
                              type="date"
                              aria-label={`Shift date for ${item.title}`}
                              value={activeDay.dateStr}
                              onChange={(e) => handleShiftTaskDate(item.id, e.target.value)}
                              className="min-w-0 rounded border border-border bg-input px-1.5 py-0.5 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Workload Schedule - a single scannable list of rows
            (day/date, a bar proportional to the week's busiest day, hours,
            item count, intensity) rather than seven separate tiles, so
            relative load reads top-to-bottom instead of being eyeballed
            across seven disconnected boxes. Always the calm, static brand
            Neon Edge (accent="glow") - this card never pulses; severity
            escalation belongs to the Workload Load card's own glow. */}
        <Card accent="glow" className="xl:col-span-2 p-5">
          <CardHeader className="space-y-0 border-b border-border p-0 pb-5">
            <CardTitle>7-Day Forecast</CardTitle>
            <CardDescription className="mt-1">{breakdown.thisWeek.weekLabel}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="divide-y divide-border">
              {breakdown.next7Days.map((day) => {
                const hrs = (day.totalMinutes / 60).toFixed(1);
                const isSelected = activeDay.dateStr === day.dateStr;
                const level = INTENSITY_TO_LEVEL[day.intensity];
                const barPct = Math.max(4, (day.totalMinutes / maxMinutes) * 100);

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => setSelectedDayDate(day.dateStr)}
                    aria-current={isSelected}
                    className={cn(
                      'grid w-full grid-cols-[3.25rem_1fr_auto] items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset sm:grid-cols-[4rem_1fr_auto_auto_4.5rem]',
                      isSelected && 'bg-primary/5',
                    )}
                  >
                    <span className="text-xs font-bold text-foreground">
                      {day.dayName}
                      <span className="block text-[10px] font-medium text-muted-foreground">
                        {day.formattedDate}
                      </span>
                    </span>
                    <span className="hidden h-1.5 overflow-hidden rounded-full bg-muted sm:block">
                      <span
                        className={cn('block h-full rounded-full', WORKLOAD_SWATCH_CLASS[level])}
                        style={{ width: `${barPct}%` }}
                      />
                    </span>
                    <span className="text-right text-sm font-bold tabular-nums text-foreground sm:text-left">
                      {hrs}h
                    </span>
                    <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground sm:block">
                      {day.items.length} {day.items.length === 1 ? 'item' : 'items'}
                    </span>
                    <span
                      className={cn(
                        'hidden text-right text-[10px] font-bold uppercase tracking-wide sm:block',
                        WORKLOAD_TEXT_CLASS[level],
                      )}
                    >
                      {day.intensity === 'heavy' ? '⚠️ Heavy' : day.intensity}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <ProjectChunkerModal open={chunkerOpen} onClose={() => setChunkerOpen(false)} />
    </div>
  );
}
