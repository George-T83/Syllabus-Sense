/**
 * Exam Collision & Triple-Deadline Detection Engine (Item 39)
 *
 * Scans a student's schedule items for dangerous deadline clusters —
 * any 48-hour window with 2+ exams/quizzes, or 3+ graded items — and
 * surfaces them as CollisionAlerts so the dashboard can warn early.
 */
import { parseDayKey, toDayKey } from '@/lib/calendar/dates';
import type { ScheduleItem } from '@/types/schedule';

/** A detected cluster of overlapping high-stakes deadlines. */
export interface CollisionAlert {
  /** The earliest due date in the cluster (YYYY-MM-DD). */
  date: string;
  /** All items in the 48-hour window. */
  items: ScheduleItem[];
  /** 'critical' = 2+ exams; 'warning' = 3+ graded items (no 2+ exams). */
  severity: 'warning' | 'critical';
}

const GRADED_TYPES = new Set(['exam', 'quiz', 'assignment', 'project', 'presentation', 'lab']);
const EXAM_TYPES = new Set(['exam', 'quiz']);
const MS_48H = 48 * 60 * 60 * 1000;

/**
 * Resolves a schedule item's due date to a local-midnight timestamp for its
 * calendar day, using the same local-time bucketing convention as the rest
 * of the app (see calendar/dates.ts). A bare `YYYY-MM-DD` due date and a
 * full ISO due date (e.g. end-of-day) on the same calendar day must land on
 * the same bucket here, or they'd silently miss each other's 48h window.
 */
function dueDateDayMs(item: ScheduleItem): number {
  return parseDayKey(toDayKey(item.dueDate)).getTime();
}

/**
 * Detects dangerous deadline clusters in a student's schedule.
 *
 * Algorithm: for each graded item, scan all other graded items whose
 * due date falls within 48 hours of it. If any such window contains
 * 2+ exams/quizzes it is 'critical'; if it contains 3+ graded items
 * of any type it is 'warning'. Deduplicated so each cluster only
 * appears once, anchored to the earliest item's date.
 */
export function detectExamCollisions(items: ScheduleItem[]): CollisionAlert[] {
  const graded = items.filter((item) => !item.completed && GRADED_TYPES.has(item.type));

  if (graded.length < 2) return [];

  // Sort ascending by due date so we can walk forward efficiently
  const sorted = [...graded].sort((a, b) => dueDateDayMs(a) - dueDateDayMs(b));

  const alerts: CollisionAlert[] = [];
  // Track which item IDs have already been included in an alert to avoid
  // emitting overlapping alerts for the same cluster.
  const consumed = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    if (consumed.has(sorted[i].id)) continue;

    const anchorMs = dueDateDayMs(sorted[i]);
    const window: ScheduleItem[] = [sorted[i]];

    for (let j = i + 1; j < sorted.length; j++) {
      const candidateMs = dueDateDayMs(sorted[j]);
      if (candidateMs - anchorMs <= MS_48H) {
        window.push(sorted[j]);
      }
    }

    if (window.length < 2) continue;

    const examCount = window.filter((item) => EXAM_TYPES.has(item.type)).length;
    const isCritical = examCount >= 2;
    const isWarning = window.length >= 3;

    if (!isCritical && !isWarning) continue;

    // Mark all items in this cluster as consumed
    for (const item of window) consumed.add(item.id);

    alerts.push({
      date: toDayKey(sorted[i].dueDate),
      items: window,
      severity: isCritical ? 'critical' : 'warning',
    });
  }

  return alerts;
}
