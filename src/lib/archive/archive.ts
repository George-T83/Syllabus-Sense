import type { Course } from '@/types/schedule';

/**
 * Archiving a course keeps everything it has but takes it out of use: an
 * archived course, and every task, contact, source, flashcard, quiz and quiz
 * attempt that belongs to it, is left out of the active app state (so every
 * screen that reads it), the subscribed calendar feed and the Advisor, until
 * the student restores it. Deleting forever is a separate action.
 */

export function isArchived(course: Pick<Course, 'archivedAt'>): boolean {
  return Boolean(course.archivedAt);
}

/** The ids of the archived courses in `courses`. */
export function archivedCourseIds(courses: Pick<Course, 'id' | 'archivedAt'>[]): Set<string> {
  return new Set(courses.filter(isArchived).map((c) => c.id));
}

/** Records that belong to a course, by `courseId`. */
export interface CourseScoped {
  courseId?: string;
}

/** `records` without those that belong to an archived course. Returns the
 * same array when no course is archived. */
export function withoutArchivedRecords<T extends CourseScoped>(
  records: T[],
  archivedIds: Set<string>,
): T[] {
  if (archivedIds.size === 0) return records;
  return records.filter((r) => !r.courseId || !archivedIds.has(r.courseId));
}

/** The records that belong to an archived course. */
export function onlyArchivedRecords<T extends CourseScoped>(
  records: T[],
  archivedIds: Set<string>,
): T[] {
  if (archivedIds.size === 0) return [];
  return records.filter((r) => Boolean(r.courseId && archivedIds.has(r.courseId)));
}

/**
 * For code that reads courses straight from the database (the calendar feed
 * on the server): the courses in use and their records, archived ones gone.
 */
export function withoutArchived<T extends CourseScoped>(
  courses: Course[],
  records: T[],
): { courses: Course[]; records: T[] } {
  const ids = archivedCourseIds(courses);
  return {
    courses: courses.filter((c) => !isArchived(c)),
    records: withoutArchivedRecords(records, ids),
  };
}
