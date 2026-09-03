'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { loadSessions } from '@/lib/focus/pomodoroSessions';
import {
  getSessionDateSet,
  computeCurrentStreak,
  computeHeatmapDays,
} from '@/lib/focus/studyStreak';

const HEATMAP_DAYS = 28;

/**
 * A quiet, always-visible study streak built from completed Focus Timer
 * sessions. Deliberately a local-device metric, not synced through
 * Firestore - Pomodoro sessions themselves are localStorage-only (see
 * lib/focus/pomodoroSessions.ts), so a streak that claimed to be
 * account-wide would be lying about what it actually measures. Promoting
 * session history to Firestore is a bigger, separate change.
 */
export function StudyStreakCard() {
  // Sessions live in localStorage, written by a different mounted component
  // (PomodoroTimer) - read once on mount rather than trying to keep this in
  // sync live, since the streak only meaningfully changes once a session
  // actually completes and the page is revisited.
  const [dateSet, setDateSet] = useState<Set<string> | null>(null);

  useEffect(() => {
    setDateSet(getSessionDateSet(loadSessions()));
  }, []);

  if (!dateSet) return null;

  const streak = computeCurrentStreak(dateSet);
  const heatmap = computeHeatmapDays(dateSet, new Date(), HEATMAP_DAYS);

  if (streak === 0 && heatmap.every((day) => !day.active)) {
    return null;
  }

  return (
    <Card className="rounded-2xl p-6" data-testid="study-streak-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Study streak</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Days in a row with at least one completed focus session, on this device.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-primary tabular-nums">{streak}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            day{streak === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1" aria-hidden="true">
        {heatmap.map((day) => (
          <div
            key={day.dateKey}
            title={day.dateKey}
            className={`h-3 w-3 rounded-sm ${
              day.active ? 'bg-primary' : day.isToday ? 'border border-primary/40' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Last {HEATMAP_DAYS} days</p>
    </Card>
  );
}
