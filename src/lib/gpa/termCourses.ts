import { courseStanding } from '@/lib/academic/gradeMath';
import { GRADE_POINT_MAP, type CourseGradeEntry, type LetterGrade } from '@/lib/gpa/gpaMath';
import type { Course, ScheduleItem } from '@/types/schedule';

export interface GpaGoalCourse extends CourseGradeEntry {
  /** Where the grade comes from, e.g. "Currently 87.3% (B+)". Absent when
   * nothing is graded yet. */
  standingNote?: string;
}

const isLetterGrade = (letter: string): letter is LetterGrade => letter in GRADE_POINT_MAP;

/**
 * One GPA-simulator row per course, built from the student's real data and
 * nothing else: credits come from the course (3 when unset, the same default
 * every other GPA calculation in the app uses) and the grade is the course's
 * actual current standing. A course with nothing graded yet gets a null grade,
 * so it is left out of the GPA instead of being assumed.
 *
 * Uses the same standing and credit rules as `summarizeSemesterGpa`, so the
 * Courses page headline and the Profile simulator start from the same number.
 */
export function buildGpaGoalCourses(
  courses: Pick<Course, 'id' | 'code' | 'title' | 'credits'>[],
  scheduleItems: ScheduleItem[],
): GpaGoalCourse[] {
  const itemsByCourseId = new Map<string, ScheduleItem[]>();
  for (const item of scheduleItems) {
    const existing = itemsByCourseId.get(item.courseId);
    if (existing) existing.push(item);
    else itemsByCourseId.set(item.courseId, [item]);
  }

  return courses.map((course) => {
    const standing = courseStanding(itemsByCourseId.get(course.id) ?? []);
    const grade = standing && isLetterGrade(standing.letter) ? standing.letter : null;
    return {
      courseId: course.id,
      courseCode: course.code,
      title: course.title,
      credits: course.credits ?? 3,
      grade,
      standingNote: standing ? `Currently ${standing.percentage}% (${standing.letter})` : undefined,
    };
  });
}
