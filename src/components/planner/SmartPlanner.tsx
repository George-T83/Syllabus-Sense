'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { WORKLOAD_LEVEL_LABELS } from '@/lib/workload';
import {
  computeSmartPlan,
  getLocalReferenceDate,
  type PlannedItem,
} from '@/lib/planner/computeSmartPlan';
import { cn } from '@/lib/utils';
import type { WorkloadLevel } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const LEVEL_DOT_CLASS: Record<WorkloadLevel, string> = {
  low: 'bg-load-low',
  medium: 'bg-load-medium',
  high: 'bg-load-high',
  critical: 'bg-load-critical',
};

const LEVEL_TEXT_CLASS: Record<WorkloadLevel, string> = {
  low: 'text-load-low',
  medium: 'text-load-medium',
  high: 'text-load-high',
  critical: 'text-load-critical',
};

export function SmartPlanner() {
  const { state } = useAppState();
  const { courses, scheduleItems } = state;

  const referenceDate = useMemo(() => getLocalReferenceDate(), []);
  const plan = useMemo(
    () => computeSmartPlan(scheduleItems, referenceDate),
    [scheduleItems, referenceDate],
  );

  const totalPlanned = plan.startToday.length + plan.startThisWeek.length + plan.startLater.length;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Next 7 Days</h2>
        <div className="grid grid-cols-7 gap-2">
          {plan.weekLoad.map(({ key, day, level }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {dayLabelFormatter.format(day)}
              </span>
              <span className={cn('h-2 w-2 rounded-full', LEVEL_DOT_CLASS[level])} />
              <span className={cn('text-[10px] font-medium', LEVEL_TEXT_CLASS[level])}>
                {WORKLOAD_LEVEL_LABELS[level]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {totalPlanned === 0 ? (
        <Card className="rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">
            Nothing to plan. You&apos;re all caught up.
          </p>
        </Card>
      ) : (
        <>
          <PlanSection title="Start Today" items={plan.startToday} courses={courses} urgent />
          <PlanSection title="Start This Week" items={plan.startThisWeek} courses={courses} />
          <PlanSection title="Later" items={plan.startLater} courses={courses} />
        </>
      )}
    </div>
  );
}

function PlanSection({
  title,
  items,
  courses,
  urgent,
}: {
  title: string;
  items: PlannedItem[];
  courses: { id: string; code: string; color?: string }[];
  urgent?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="rounded-2xl p-6">
      <h2
        className={cn('text-sm font-semibold mb-3', urgent ? 'text-load-high' : 'text-foreground')}
      >
        {title}
      </h2>
      <div className="divide-y divide-border">
        {items.map(({ item, overloaded }) => {
          const course = courses.find((c) => c.id === item.courseId);
          return (
            <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={cn('h-2 w-2 rounded-full shrink-0', course?.color || 'bg-primary')}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {course ? course.code : 'General'}
                </div>
              </div>
              {overloaded && (
                <span className="text-[10px] font-semibold text-load-critical shrink-0">
                  Overloaded
                </span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                Due {dueDateFormatter.format(new Date(item.dueDate))}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
