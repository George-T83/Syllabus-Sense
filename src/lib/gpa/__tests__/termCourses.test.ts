import { describe, it, expect } from 'vitest';
import { buildGpaGoalCourses } from '../termCourses';
import { calculateTermGpa } from '../gpaMath';
import { summarizeSemesterGpa } from '@/lib/academic/gradeMath';
import type { ScheduleItem } from '@/types/schedule';

const item = (
  over: Partial<ScheduleItem> & Pick<ScheduleItem, 'id' | 'courseId'>,
): ScheduleItem => ({
  title: 'Item',
  type: 'assignment',
  dueDate: '2026-11-01T23:59:00.000Z',
  completed: true,
  ...over,
});

const courses = [
  { id: 'a', code: 'CSCI 213', title: 'CS I', credits: 4 },
  { id: 'b', code: 'MATH 301', title: 'Linear Algebra', credits: 3 },
  { id: 'c', code: 'HIST 150', title: 'History' }, // credits unset
];

const items: ScheduleItem[] = [
  item({ id: '1', courseId: 'a', gradeWeight: 20, earnedScore: 96 }),
  item({ id: '2', courseId: 'b', gradeWeight: 15, earnedScore: 78 }),
];

describe('buildGpaGoalCourses', () => {
  it('uses the real standing as the grade and the course credits as credits', () => {
    const rows = buildGpaGoalCourses(courses, items);
    expect(rows[0]).toMatchObject({ courseId: 'a', credits: 4, grade: 'A' });
    expect(rows[0].standingNote).toBe('Currently 96% (A)');
    expect(rows[1]).toMatchObject({ courseId: 'b', credits: 3, grade: 'C+' });
  });

  it('leaves a course with nothing graded ungraded instead of assuming a grade', () => {
    const [, , ungraded] = buildGpaGoalCourses(courses, items);
    expect(ungraded.grade).toBeNull();
    expect(ungraded.standingNote).toBeUndefined();
  });

  it('defaults unset credits to 3, matching every other GPA calculation', () => {
    const [, , ungraded] = buildGpaGoalCourses(courses, items);
    expect(ungraded.credits).toBe(3);
  });

  it('does not guess credits from the course code', () => {
    const [row] = buildGpaGoalCourses(
      [{ id: 'x', code: 'ECE 211', title: 'Circuits', credits: 3 }],
      [],
    );
    expect(row.credits).toBe(3);
  });

  it('starts from exactly the same GPA the Courses page headline shows', () => {
    const rows = buildGpaGoalCourses(courses, items);
    const profileGpa = calculateTermGpa(rows).termGpa;

    const byCourse = new Map<string, ScheduleItem[]>();
    for (const i of items) byCourse.set(i.courseId, [...(byCourse.get(i.courseId) ?? []), i]);
    const coursesPageGpa = summarizeSemesterGpa(courses, byCourse)?.gpa;

    expect(profileGpa).toBe(coursesPageGpa);
  });
});

describe('calculateTermGpa with ungraded courses', () => {
  it('skips null grades instead of counting them as 0.0', () => {
    const result = calculateTermGpa([
      { courseId: 'a', courseCode: 'A', title: 'A', credits: 4, grade: 'A' },
      { courseId: 'b', courseCode: 'B', title: 'B', credits: 4, grade: null },
    ]);
    expect(result.termGpa).toBe(4);
    expect(result.totalCredits).toBe(4);
  });

  it('reports no GPA when nothing is graded', () => {
    const result = calculateTermGpa([
      { courseId: 'b', courseCode: 'B', title: 'B', credits: 4, grade: null },
    ]);
    expect(result.totalCredits).toBe(0);
  });
});
