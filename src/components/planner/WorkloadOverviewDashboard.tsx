'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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
import { WORKLOAD_BADGE_CLASS } from '@/lib/workload';
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

/** Day-tile border/background per level, including hover - kept as literal
 * class strings (not built with template interpolation) so Tailwind's
 * static scanner can see them. */
const DAY_TILE_LEVEL_CLASS: Record<WorkloadLevel, string> = {
  low: 'border-load-low/30 bg-load-low/10 hover:bg-load-low/15',
  medium: 'border-load-medium/30 bg-load-medium/10 hover:bg-load-medium/15',
  high: 'border-load-high/30 bg-load-high/10 hover:bg-load-high/15',
  critical: 'border-load-critical/40 bg-load-critical/10 hover:bg-load-critical/15',
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
              <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
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

      {/* Grid: Day Details & Workload Load + 7-Day Forecast Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Selected Day Workload Meter & Task Inspector */}
        <Card className="lg:col-span-1 p-5">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Workload Load ({activeDay.dayName}, {activeDay.formattedDate})
              </CardTitle>
              {activeDay.dateStr === breakdown.today.dateStr && (
                <span className="text-[10px] font-bold text-primary">● Today</span>
              )}
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize',
                WORKLOAD_BADGE_CLASS[INTENSITY_TO_LEVEL[activeDay.intensity]],
              )}
            >
              {activeDay.intensity === 'heavy' ? '⚠️ Heavy Peak' : `${activeDay.intensity} Pace`}
            </span>
          </CardHeader>

          <CardContent className="p-0 pt-2 space-y-4">
            <div className="flex items-baseline justify-between border-b border-border/50 pb-3">
              <div>
                <span className="text-3xl font-extrabold text-foreground">
                  {activeDayHours} hrs
                </span>
                <span className="text-xs text-muted-foreground"> total scheduled study load</span>
              </div>
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
                <ul className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
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

                      {/* Manual Date Shift Control with Date Picker & Quick-Shift Controls */}
                      {!item.completed && (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
                          <span className="shrink-0">Move to another day:</span>
                          <div className="flex items-center gap-1">
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
                              className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Weekly Workload Schedule (Interactive 7-Day Forecast Grid) */}
        <Card className="lg:col-span-2 p-5">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                7-Day Workload Forecast ({breakdown.thisWeek.weekLabel})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Click any day to inspect tasks or manually shift bites to balance heavy days.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {breakdown.next7Days.map((day) => {
                const hrs = (day.totalMinutes / 60).toFixed(1);
                const isSelected = activeDay.dateStr === day.dateStr;

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => setSelectedDayDate(day.dateStr)}
                    className={cn(
                      'flex flex-col justify-between rounded-2xl border p-3 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary',
                      isSelected && 'ring-2 ring-primary border-primary',
                      DAY_TILE_LEVEL_CLASS[INTENSITY_TO_LEVEL[day.intensity]],
                    )}
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {day.dayName}
                      </span>
                      <p className="text-xs font-semibold text-foreground mt-0.5">
                        {day.formattedDate}
                      </p>
                    </div>

                    <div className="my-3">
                      <span className="text-lg font-extrabold text-foreground">{hrs}h</span>
                      <p className="text-[10px] text-muted-foreground">{day.items.length} items</p>
                    </div>

                    <span
                      className={cn(
                        'mt-auto rounded-full py-0.5 text-[9px] font-bold uppercase',
                        WORKLOAD_BADGE_CLASS[INTENSITY_TO_LEVEL[day.intensity]],
                      )}
                    >
                      {day.intensity === 'heavy' ? '⚠️ Heavy Peak' : day.intensity}
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
