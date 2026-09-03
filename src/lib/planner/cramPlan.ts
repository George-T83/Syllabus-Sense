import { parseDayKey, startOfDay } from '@/lib/calendar/dates';

/** A cram plan longer than this stops being a "cram" - kept in sync with the
 * same constant enforced server-side in /api/syllabus/cram-plan/route.ts,
 * which doesn't trust the client's arithmetic either. */
export const MAX_CRAM_DAYS = 14;

/** Calendar days between today and an exam's due date. 1 means the exam is
 * tomorrow; 0 or negative means it's today or already past. */
export function daysUntilExam(examDueDate: string, today: Date = new Date()): number {
  const examDay = parseDayKey(examDueDate);
  const todayStart = startOfDay(today);
  return Math.round((examDay.getTime() - todayStart.getTime()) / 86_400_000);
}

/** How many days a generated cram plan should actually span - the full time
 * remaining, capped so a distant exam doesn't produce a month-long plan. */
export function cramPlanLength(daysUntil: number, maxDays: number = MAX_CRAM_DAYS): number {
  return Math.min(Math.max(daysUntil, 0), maxDays);
}
