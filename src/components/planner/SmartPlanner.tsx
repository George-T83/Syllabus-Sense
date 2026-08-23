'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateScheduleItem } from '@/lib/firestore/scheduleItems';
import { getWorkloadLevel, WORKLOAD_LEVEL_LABELS, WORKLOAD_CHIP_CLASS, WORKLOAD_TEXT_CLASS, toDateOnly } from '@/lib/workload';
import {
  computeSmartPlan,
  getLocalReferenceDate,
  type PlannedItem,
} from '@/lib/planner/computeSmartPlan';
import { cn } from '@/lib/utils';
import type { Course, ScheduleItem } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const dayDetailFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * Formats a `YYYY-MM-DD` planning key (`PlannedItem.startDate`, always a
 * UTC-normalized date-only string - see lib/workload/dateUtils.ts) as local
 * calendar text. Goes through `toDateOnly` and reads UTC getters back into a
 * *local* Date's Y/M/D components rather than formatting the UTC-midnight
 * Date directly, so a negative-UTC-offset viewer's Intl formatter can't roll
 * it back a day - the same class of bug documented on `toDateOnly` itself.
 */
function formatPlanDateKey(dateKey: string): string {
  const d = toDateOnly(dateKey);
  return dueDateFormatter.format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function SmartPlanner() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { courses, scheduleItems } = state;

  const referenceDate = useMemo(() => getLocalReferenceDate(), []);
  const plan = useMemo(
    () => computeSmartPlan(scheduleItems, referenceDate),
    [scheduleItems, referenceDate],
  );

  const totalPlanned = plan.startToday.length + plan.startThisWeek.length + plan.startLater.length;
  const todayLoad = plan.weekLoad[0];
  const todayLevel = getWorkloadLevel(todayLoad.hours);
  const hasOverdueBacklog = plan.overdueHours > 1e-9;

  // PL-4: bucketed by RECOMMENDED START date (PlannedItem.startDate), the
  // same concept every other section of this page ("Start Today" / "Start
  // This Week" / "Later") is organized around - not by due date. Built from
  // the plan's own already-computed buckets rather than re-deriving from
  // scheduleItems, so a forecast tile's expanded panel can never disagree
  // with which section a given item actually landed in above.
  const itemsByStartDate = useMemo(() => {
    const map = new Map<string, PlannedItem[]>();
    const allPlanned = [...plan.startToday, ...plan.startThisWeek, ...plan.startLater];
    for (const planned of allPlanned) {
      const existing = map.get(planned.startDate);
      if (existing) existing.push(planned);
      else map.set(planned.startDate, [planned]);
    }
    return map;
  }, [plan]);

  const [selectedForecastKey, setSelectedForecastKey] = useState<string | null>(null);
  const selectedForecastDay = plan.weekLoad.find((d) => d.key === selectedForecastKey);
  const selectedDayItems = selectedForecastKey
    ? (itemsByStartDate.get(selectedForecastKey) ?? [])
    : [];

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
  };

  return (
    <div className="space-y-6">
      {/* Hero: today's load is the single most useful glanceable fact on this
          page, so it gets a large number instead of being buried in the
          7-day strip alongside every other day. */}
      <Card accent className="rounded-2xl p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today&apos;s Load
          </span>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-semibold',
              WORKLOAD_CHIP_CLASS[todayLevel],
              WORKLOAD_TEXT_CLASS[todayLevel],
            )}
          >
            {WORKLOAD_LEVEL_LABELS[todayLevel]}
          </span>
        </div>
        {/* PL-1: split into two figures instead of one. The old single
            "Today's Load" number only ever summed items due today through
            +6 days (weekLoad) - an overdue item's hours land on its own
            PAST due date and never made it into this number, even though
            the Overdue-badged rows sit directly underneath it. Showing the
            backlog total alongside it (rather than folding it in) keeps the
            "due today" figure meaningful on its own while making the
            catch-up debt visible instead of silently dropped. */}
        <div className="mb-1 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {todayLoad.hours.toFixed(1)}
              <span className="text-lg font-semibold text-muted-foreground sm:text-xl">h</span>
            </span>
            <span className="pb-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
              due today
            </span>
          </div>
          {hasOverdueBacklog && (
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold tracking-tight text-destructive sm:text-3xl">
                {plan.overdueHours.toFixed(1)}
                <span className="text-sm font-semibold text-destructive/70 sm:text-base">h</span>
              </span>
              <span className="pb-1 text-xs font-medium text-muted-foreground sm:text-sm">
                overdue backlog
              </span>
            </div>
          )}
        </div>
        {/* VA-2: narrate the computation instead of leaving it as a bare
            number - this is where the workload engine's actual
            intelligence (type-weighted, progress-aware, stress-adjusted
            hours - see lib/workload) lives, and nothing on screen said so. */}
        <p className="mb-5 text-xs text-muted-foreground">
          Calculated from your exams, projects, and readings - weighted by type and
          progress, not just a headcount.
        </p>

        {plan.startToday.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
            title="Nothing to start today"
            description="You're caught up - check back tomorrow."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {plan.startToday.map(({ item, startDate, overloaded, tight, overdue }) => (
              <PlannedTaskRow
                key={item.id}
                variant={state.preferences.taskRowVariant}
                item={item}
                startDate={startDate}
                course={courses.find((c) => c.id === item.courseId)}
                overloaded={overloaded}
                tight={tight}
                overdue={overdue}
                onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="rounded-2xl p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">7-Day Forecast</h2>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {plan.weekLoad.map(({ key, day, hours, level }) => {
            // A day with zero hours isn't a "Low" workload day - it's a day
            // with no data. Coloring it green would misread as "you're fine
            // today" when really nothing has been planned for it yet, so it
            // stays visually neutral instead of borrowing the lowest tier's
            // color.
            const hasLoad = hours > 0;
            const isSelected = selectedForecastKey === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedForecastKey((prev) => (prev === key ? null : key))}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg border p-1 text-left transition-all sm:gap-1 sm:rounded-xl sm:p-2.5',
                  hasLoad ? WORKLOAD_CHIP_CLASS[level] : 'border-border bg-accent/40',
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                    : 'hover:-translate-y-0.5',
                )}
              >
                <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                  {dayLabelFormatter.format(day)}
                </span>
                <span className="text-sm font-bold text-foreground sm:text-lg">
                  {day.getDate()}
                </span>
                <span
                  className={cn(
                    'text-[8px] font-semibold sm:text-[10px]',
                    hasLoad ? WORKLOAD_TEXT_CLASS[level] : 'text-muted-foreground',
                  )}
                >
                  {hasLoad ? `${hours.toFixed(1)}h` : 'Free'}
                </span>
              </button>
            );
          })}
        </div>

        {selectedForecastDay && (
          <div className="mt-5 border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {dayDetailFormatter.format(selectedForecastDay.day)}
            </h3>
            {selectedDayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recommended to start this day.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedDayItems.map(({ item, startDate, overloaded, tight, overdue }) => (
                  <PlannedTaskRow
                    key={item.id}
                    variant={state.preferences.taskRowVariant}
                    item={item}
                    startDate={startDate}
                    course={courses.find((c) => c.id === item.courseId)}
                    overloaded={overloaded}
                    tight={tight}
                    overdue={overdue}
                    onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {totalPlanned === 0 ? null : (
        <>
          <PlanSection
            title="Start This Week"
            items={plan.startThisWeek}
            courses={courses}
            variant={state.preferences.taskRowVariant}
            onToggleComplete={user ? handleToggleComplete : undefined}
          />
          <PlanSection
            title="Later"
            items={plan.startLater}
            courses={courses}
            variant={state.preferences.taskRowVariant}
            onToggleComplete={user ? handleToggleComplete : undefined}
          />
        </>
      )}
    </div>
  );
}

function PlannedTaskRow({
  item,
  startDate,
  course,
  overloaded,
  tight,
  overdue,
  onToggleComplete,
  variant,
}: {
  item: PlannedItem['item'];
  startDate: string;
  course: Course | undefined;
  overloaded: boolean;
  tight: boolean;
  overdue: boolean;
  onToggleComplete?: () => void;
  variant?: 'card' | 'touch';
}) {
  const dueLabel = dueDateFormatter.format(new Date(item.dueDate));
  const startLabel = formatPlanDateKey(startDate);
  return (
    <TaskRow
      variant={variant}
      title={item.title}
      href={`/tasks/${item.id}`}
      type={item.type}
      courseCode={course ? course.code : 'General'}
      courseColor={course?.color}
      courseIcon={course?.icon}
      completed={item.completed}
      progress={item.progress}
      priority={item.priority}
      onToggleComplete={onToggleComplete}
      // PL-2: stacked (not side-by-side) so the trailing block's natural
      // width is the widest SINGLE line, not badge+gap+date combined - this
      // is what keeps the row within a 375px viewport without touching
      // TaskRow.tsx's own `flex shrink-0` wrapper (owned by another agent
      // this round). PL-3: prints the recommended start date - previously
      // computed but discarded before reaching the screen - alongside the
      // due date, both labeled, instead of only the due date.
      trailing={
        <div className="flex flex-col items-end gap-1 text-right">
          {overdue ? (
            <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              Overdue
            </span>
          ) : overloaded ? (
            <span className="whitespace-nowrap rounded-full bg-load-critical/10 px-2 py-0.5 text-[10px] font-semibold text-load-critical">
              Overloaded
            </span>
          ) : (
            tight && (
              // PL-5: middle tier between a comfortable day and a genuinely
              // overloaded one - styled with the 'high' load token
              // (amber-ish), one step down in alarm from 'critical' (red).
              <span className="whitespace-nowrap rounded-full bg-load-high/10 px-2 py-0.5 text-[10px] font-semibold text-load-high">
                Tight
              </span>
            )
          )}
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            Start {startLabel}
          </span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">Due {dueLabel}</span>
        </div>
      }
    />
  );
}

function PlanSection({
  title,
  items,
  courses,
  variant,
  onToggleComplete,
}: {
  title: string;
  items: PlannedItem[];
  courses: Course[];
  variant?: 'card' | 'touch';
  onToggleComplete?: (item: ScheduleItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="rounded-2xl p-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map(({ item, startDate, overloaded, tight, overdue }) => (
          <PlannedTaskRow
            key={item.id}
            item={item}
            startDate={startDate}
            course={courses.find((c) => c.id === item.courseId)}
            overloaded={overloaded}
            tight={tight}
            overdue={overdue}
            variant={variant}
            onToggleComplete={onToggleComplete ? () => onToggleComplete(item) : undefined}
          />
        ))}
      </div>
    </Card>
  );
}
