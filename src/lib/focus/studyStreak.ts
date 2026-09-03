import { toDayKey, parseDayKey } from '@/lib/calendar/dates';
import type { PomodoroSession } from '@/lib/focus/pomodoroSessions';

/** Distinct local calendar days on which at least one focus session was
 * completed - a day with three sessions still only counts once toward a
 * streak. */
export function getSessionDateSet(sessions: PomodoroSession[]): Set<string> {
  return new Set(sessions.map((s) => toDayKey(s.startedAt)));
}

function addDays(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/**
 * Current consecutive-day streak of completed focus sessions, ending today.
 *
 * If today has no session yet, the streak isn't broken until the day is
 * actually over - counting starts from yesterday instead, so a student who
 * hasn't opened the timer yet this morning doesn't see their streak reset
 * to 0 before they've had a chance to study.
 */
export function computeCurrentStreak(dateSet: Set<string>, today: Date = new Date()): number {
  let cursor = toDayKey(today);
  if (!dateSet.has(cursor)) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface HeatmapDay {
  dateKey: string;
  active: boolean;
  isToday: boolean;
}

/** The last `days` calendar days (oldest first, ending today) with whether
 * each had a completed session - feeds a small calendar-heatmap grid. */
export function computeHeatmapDays(
  dateSet: Set<string>,
  today: Date = new Date(),
  days = 28,
): HeatmapDay[] {
  const todayKey = toDayKey(today);
  const result: HeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = addDays(todayKey, -i);
    result.push({ dateKey, active: dateSet.has(dateKey), isToday: dateKey === todayKey });
  }
  return result;
}
