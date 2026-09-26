import { describe, it, expect } from 'vitest';
import {
  buildDegreeRoute,
  categoryCourseBlocks,
  computeCategoryProgress,
  computeOverallProgress,
  groupCoursesByTerm,
  sortCoursesByTerm,
} from '../progress';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

const majorCore: DegreeRequirementCategory = {
  id: 'core',
  name: 'Major Core',
  creditsRequired: 12,
};
const genEd: DegreeRequirementCategory = {
  id: 'genEd',
  name: 'General Education',
  creditsRequired: 9,
};
const categories = [majorCore, genEd];

function course(overrides: Partial<DegreeCourse>): DegreeCourse {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    term: 'Fall 2026',
    code: 'CS 101',
    credits: 4,
    categoryId: majorCore.id,
    status: 'completed',
    ...overrides,
  };
}

describe('computeCategoryProgress', () => {
  it('sums completed and in-progress credits separately per category', () => {
    const courses = [
      course({ categoryId: majorCore.id, credits: 4, status: 'completed' }),
      course({ categoryId: majorCore.id, credits: 4, status: 'in-progress' }),
      course({ categoryId: genEd.id, credits: 3, status: 'completed' }),
    ];

    const result = computeCategoryProgress(categories, courses);

    const core = result.find((r) => r.category.id === majorCore.id)!;
    expect(core.creditsCompleted).toBe(4);
    expect(core.creditsInProgress).toBe(4);
    expect(core.creditsRemaining).toBe(4); // 12 - 4 - 4

    const gened = result.find((r) => r.category.id === genEd.id)!;
    expect(gened.creditsCompleted).toBe(3);
    expect(gened.creditsRemaining).toBe(6);
  });

  it('excludes planned courses from completed/in-progress totals', () => {
    const courses = [course({ categoryId: majorCore.id, credits: 4, status: 'planned' })];
    const result = computeCategoryProgress(categories, courses);
    const core = result.find((r) => r.category.id === majorCore.id)!;
    expect(core.creditsCompleted).toBe(0);
    expect(core.creditsInProgress).toBe(0);
    expect(core.creditsRemaining).toBe(12);
  });

  it('never reports negative remaining credits when a category is over-fulfilled', () => {
    const courses = [course({ categoryId: genEd.id, credits: 20, status: 'completed' })];
    const result = computeCategoryProgress(categories, courses);
    const gened = result.find((r) => r.category.id === genEd.id)!;
    expect(gened.creditsRemaining).toBe(0);
  });

  it('returns zeroed progress for a category with no matching courses', () => {
    const result = computeCategoryProgress(categories, []);
    expect(result).toEqual([
      { category: majorCore, creditsCompleted: 0, creditsInProgress: 0, creditsRemaining: 12 },
      { category: genEd, creditsCompleted: 0, creditsInProgress: 0, creditsRemaining: 9 },
    ]);
  });
});

describe('computeOverallProgress', () => {
  it('aggregates required, completed, and in-progress credits across all categories', () => {
    const courses = [
      course({ categoryId: majorCore.id, credits: 4, status: 'completed' }),
      course({ categoryId: genEd.id, credits: 3, status: 'in-progress' }),
    ];
    const result = computeOverallProgress(categories, courses);
    expect(result).toEqual({ creditsRequired: 21, creditsCompleted: 4, creditsInProgress: 3 });
  });
});

describe('groupCoursesByTerm', () => {
  it('groups courses by term and sums total credits per term', () => {
    const courses = [
      course({ term: 'Fall 2026', credits: 4 }),
      course({ term: 'Fall 2026', credits: 3 }),
      course({ term: 'Spring 2027', credits: 5 }),
    ];
    const groups = groupCoursesByTerm(courses);
    expect(groups.map((g) => g.term)).toEqual(['Fall 2026', 'Spring 2027']);
    expect(groups[0].totalCredits).toBe(7);
    expect(groups[1].totalCredits).toBe(5);
  });

  it('sorts parseable terms chronologically regardless of input order', () => {
    const courses = [
      course({ term: 'Spring 2027', credits: 3 }),
      course({ term: 'Fall 2025', credits: 3 }),
      course({ term: 'Fall 2026', credits: 3 }),
    ];
    const groups = groupCoursesByTerm(courses);
    expect(groups.map((g) => g.term)).toEqual(['Fall 2025', 'Fall 2026', 'Spring 2027']);
  });

  it('sorts an unparseable term label after every dateable term instead of crashing', () => {
    const courses = [
      course({ term: 'Someday', credits: 3 }),
      course({ term: 'Fall 2025', credits: 3 }),
    ];
    const groups = groupCoursesByTerm(courses);
    expect(groups.map((g) => g.term)).toEqual(['Fall 2025', 'Someday']);
  });
});

describe('sortCoursesByTerm', () => {
  it('orders courses chronologically by term regardless of Firestore snapshot order', () => {
    const courses = [
      course({ id: 'b', term: 'Spring 2026', code: 'CS 201' }),
      course({ id: 'a', term: 'Fall 2025', code: 'CS 101' }),
    ];
    const sorted = sortCoursesByTerm(courses);
    expect(sorted.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('breaks ties within the same term by course code', () => {
    const courses = [
      course({ id: 'b', term: 'Fall 2025', code: 'CS 201' }),
      course({ id: 'a', term: 'Fall 2025', code: 'CS 101' }),
    ];
    const sorted = sortCoursesByTerm(courses);
    expect(sorted.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('buildDegreeRoute', () => {
  // 21 credits required (12 core + 9 gen ed).
  const route = buildDegreeRoute(categories, [
    course({ id: 'a', term: 'Fall 2025', credits: 4, status: 'completed' }),
    course({ id: 'b', term: 'Fall 2025', credits: 3, status: 'completed', categoryId: 'genEd' }),
    course({ id: 'c', term: 'Spring 2026', credits: 4, status: 'in-progress' }),
    course({ id: 'd', term: 'Spring 2026', credits: 3, status: 'completed', categoryId: 'genEd' }),
    course({ id: 'e', term: 'Fall 2026', credits: 4, status: 'planned' }),
  ]);

  it('makes one stop per term, in order, with a running total', () => {
    expect(route.stops.map((s) => [s.term, s.state, s.credits, s.cumulativeCredits])).toEqual([
      ['Fall 2025', 'done', 7, 7],
      ['Spring 2026', 'current', 7, 14],
      ['Fall 2026', 'planned', 4, 18],
    ]);
    expect(route.stops[1].courseCount).toBe(2);
  });

  it('counts earned credits and what the plan still has to cover', () => {
    expect(route.creditsRequired).toBe(21);
    expect(route.creditsEarned).toBe(14);
    expect(route.creditsOnRoute).toBe(18);
    expect(route.creditsUnplanned).toBe(3);
    expect(route.graduationTerm).toBeNull();
  });

  it('names the graduation term once the plan reaches the requirement', () => {
    const full = buildDegreeRoute(categories, [
      course({ term: 'Fall 2025', credits: 12, status: 'completed' }),
      course({ term: 'Spring 2026', credits: 9, status: 'planned', categoryId: 'genEd' }),
    ]);
    expect(full.creditsUnplanned).toBe(0);
    expect(full.graduationTerm).toBe('Spring 2026');
  });

  it('is empty with no courses', () => {
    const empty = buildDegreeRoute(categories, []);
    expect(empty.stops).toEqual([]);
    expect(empty.creditsUnplanned).toBe(21);
    expect(empty.graduationTerm).toBeNull();
  });
});

describe('categoryCourseBlocks', () => {
  it('orders blocks completed, in progress, planned, and says what is left', () => {
    const result = categoryCourseBlocks(majorCore, [
      course({ id: 'p', code: 'CS 301', status: 'planned', credits: 4 }),
      course({ id: 'c', code: 'CS 101', status: 'completed', credits: 4 }),
      course({ id: 'i', code: 'CS 201', status: 'in-progress', credits: 3 }),
      course({ id: 'g', code: 'ENG 101', categoryId: 'genEd' }),
    ]);
    expect(result.blocks.map((b) => b.id)).toEqual(['c', 'i', 'p']);
    // 12 required - 7 earned = 5 left; 4 planned covers all but 1
    expect(result.creditsLeft).toBe(5);
    expect(result.creditsUnplanned).toBe(1);
  });

  it('reports nothing left once the requirement is met', () => {
    const result = categoryCourseBlocks(genEd, [
      course({ categoryId: 'genEd', credits: 9, status: 'completed' }),
    ]);
    expect(result.creditsLeft).toBe(0);
    expect(result.creditsUnplanned).toBe(0);
  });
});
