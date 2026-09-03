'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { calculateWorkloadBreakdown } from '@/lib/planner/projectChunker';
import type { ScheduleItem } from '@/types/schedule';

/** Monday of the calendar week containing `date`, as a YYYY-MM-DD key - used
 * to dismiss the briefing "for the week" regardless of which day the
 * student first opens the dashboard on. */
function weekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function dismissedStorageKey(uid: string, weekKey: string): string {
  return `weekly-briefing-dismissed:${uid}:${weekKey}`;
}

export interface WeeklyBriefingCardProps {
  scheduleItems: ScheduleItem[];
}

/** A once-a-week "here's what's ahead" summary, generated entirely from data
 * the workload engine already computes - no notification backend required.
 * Dismissing it hides it until the following week's Monday. */
export function WeeklyBriefingCard({ scheduleItems }: WeeklyBriefingCardProps) {
  const { user } = useAuth();
  const weekKey = useMemo(() => weekStartKey(new Date()), []);
  const [dismissed, setDismissed] = useState(() => {
    if (!user || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(dismissedStorageKey(user.uid, weekKey)) === 'true';
    } catch {
      return false;
    }
  });

  const breakdown = useMemo(() => calculateWorkloadBreakdown(scheduleItems), [scheduleItems]);

  const { thisWeek } = breakdown;
  const pendingDays = thisWeek.days.map((day) => ({
    ...day,
    items: day.items.filter((item) => !item.completed),
  }));
  const pendingItemCount = pendingDays.reduce((sum, day) => sum + day.items.length, 0);
  const examCount = pendingDays.reduce(
    (sum, day) => sum + day.items.filter((item) => item.type === 'exam').length,
    0,
  );
  const heaviestDay = pendingDays.reduce(
    (max, day) => (day.totalMinutes > max.totalMinutes ? day : max),
    pendingDays[0],
  );

  if (dismissed || pendingItemCount === 0 || !heaviestDay || heaviestDay.totalMinutes === 0) {
    return null;
  }

  const totalHours = Math.round((thisWeek.totalMinutes / 60) * 10) / 10;
  const heaviestTitles = heaviestDay.items
    .slice(0, 2)
    .map((item) => item.title)
    .join(', ');

  const handleDismiss = () => {
    setDismissed(true);
    if (!user) return;
    try {
      window.localStorage.setItem(dismissedStorageKey(user.uid, weekKey), 'true');
    } catch {
      // Non-fatal: worst case the briefing reappears next visit this week.
    }
  };

  return (
    <Card accent="none" className="rounded-2xl border-primary/20 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-primary">
            This week: {totalHours}h
            {examCount > 0 ? `, ${examCount} exam${examCount > 1 ? 's' : ''}` : ''}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Heaviest day: {heaviestDay.dayName} ({heaviestTitles}
            {heaviestDay.items.length > 2 ? `, +${heaviestDay.items.length - 2} more` : ''})
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss this week's briefing"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
      </div>
    </Card>
  );
}
