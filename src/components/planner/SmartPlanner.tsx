'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateScheduleItem } from '@/lib/firestore/scheduleItems';
import {
  getWorkloadLevel,
  WORKLOAD_LEVEL_LABELS,
  WORKLOAD_CHIP_CLASS,
  WORKLOAD_TEXT_CLASS,
  toDateOnly,
  formatDateISO,
} from '@/lib/workload';
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

  // Keyed the same way calculateDailyLoad keys plan.weekLoad (UTC-midnight
  // ISO date), so a forecast day's key always finds the items actually due
  // that day - reusing the workload engine's own date normalization instead
  // of the calendar module's local-time one avoids an off-by-one across
  // timezones.
  const itemsByDueDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of scheduleItems) {
      const key = formatDateISO(toDateOnly(item.dueDate));
      const existing = map.get(key);
      if (existing) existing.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [scheduleItems]);

  const [selectedForecastKey, setSelectedForecastKey] = useState<string | null>(null);
  const selectedForecastDay = plan.weekLoad.find((d) => d.key === selectedForecastKey);
  const selectedDayItems = selectedForecastKey
    ? (itemsByDueDate.get(selectedForecastKey) ?? [])
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
      <Card accent className="rounded-2xl p-6">
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
        <div className="mb-5 flex items-end gap-2">
          <span className="text-5xl font-bold tracking-tight text-foreground">
            {todayLoad.hours.toFixed(1)}
          </span>
          <span className="pb-1.5 text-lg font-medium text-muted-foreground">effective hours</span>
        </div>

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
          <div className="divide-y divide-border">
            {plan.startToday.map(({ item, overloaded }) => (
              <PlannedTaskRow
                key={item.id}
                item={item}
                course={courses.find((c) => c.id === item.courseId)}
                overloaded={overloaded}
                onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="rounded-2xl p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">7-Day Forecast</h2>
        <div className="grid grid-cols-7 gap-2">
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
                  'flex flex-col items-center gap-1 rounded-xl border p-2.5 text-left transition-all',
                  hasLoad ? WORKLOAD_CHIP_CLASS[level] : 'border-border bg-accent/40',
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                    : 'hover:-translate-y-0.5',
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayLabelFormatter.format(day)}
                </span>
                <span className="text-lg font-bold text-foreground">{day.getDate()}</span>
                <span
                  className={cn(
                    'text-[10px] font-semibold',
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
              <p className="text-sm text-muted-foreground">Nothing due this day.</p>
            ) : (
              <div className="divide-y divide-border">
                {selectedDayItems.map((item) => (
                  <TaskRow
                    key={item.id}
                    title={item.title}
                    type={item.type}
                    courseCode={courses.find((c) => c.id === item.courseId)?.code ?? 'General'}
                    courseColor={courses.find((c) => c.id === item.courseId)?.color}
                    completed={item.completed}
                    priority={item.priority}
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
            onToggleComplete={user ? handleToggleComplete : undefined}
          />
          <PlanSection
            title="Later"
            items={plan.startLater}
            courses={courses}
            onToggleComplete={user ? handleToggleComplete : undefined}
          />
        </>
      )}
    </div>
  );
}

function PlannedTaskRow({
  item,
  course,
  overloaded,
  onToggleComplete,
}: {
  item: PlannedItem['item'];
  course: Course | undefined;
  overloaded: boolean;
  onToggleComplete?: () => void;
}) {
  return (
    <TaskRow
      title={item.title}
      type={item.type}
      courseCode={course ? course.code : 'General'}
      courseColor={course?.color}
      completed={item.completed}
      priority={item.priority}
      onToggleComplete={onToggleComplete}
      trailing={
        <>
          {overloaded && (
            <span className="rounded-full bg-load-critical/10 px-2 py-0.5 text-[10px] font-semibold text-load-critical">
              Overloaded
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Due {dueDateFormatter.format(new Date(item.dueDate))}
          </span>
        </>
      }
    />
  );
}

function PlanSection({
  title,
  items,
  courses,
  onToggleComplete,
}: {
  title: string;
  items: PlannedItem[];
  courses: Course[];
  onToggleComplete?: (item: ScheduleItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="rounded-2xl p-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="divide-y divide-border">
        {items.map(({ item, overloaded }) => (
          <PlannedTaskRow
            key={item.id}
            item={item}
            course={courses.find((c) => c.id === item.courseId)}
            overloaded={overloaded}
            onToggleComplete={onToggleComplete ? () => onToggleComplete(item) : undefined}
          />
        ))}
      </div>
    </Card>
  );
}
