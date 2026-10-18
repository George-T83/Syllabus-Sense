import { describe, it, expect } from 'vitest';
import {
  addHypotheticalCourses,
  MAX_PLANNED_TERMS,
  partitionHypotheticals,
  planTerms,
  projectWhatIf,
  type HypotheticalCourse,
} from '../whatIf';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

const core: DegreeRequirementCategory = { id: 'core', name: 'Major Core', creditsRequired: 12 };
const genEd: DegreeRequirementCategory = {
  id: 'genEd',
  name: 'General Education',
  creditsRequired: 9,
};
const categories = [core, genEd];

function course(overrides: Partial<DegreeCourse>): DegreeCourse {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    term: 'Fall 2026',
    code: 'CS 101',
    credits: 4,
    categoryId: core.id,
    status: 'completed',
    ...overrides,
  };
}

function hypo(id: string, credits: number, categoryId: string): HypotheticalCourse {
  return { id, credits, categoryId };
}

describe('partitionHypotheticals', () => {
  it('ignores unknown categories and non-positive or non-finite credits', () => {
    const { counted, ignored } = partitionHypotheticals(categories, [
      hypo('a', 3, 'core'),
      hypo('b', 3, 'gone'),
      hypo('c', 0, 'core'),
      hypo('d', -2, 'core'),
      hypo('e', Number.NaN, 'core'),
      hypo('f', Number.POSITIVE_INFINITY, 'core'),
    ]);
    expect(counted.map((c) => c.id)).toEqual(['a']);
    expect(ignored.map((i) => [i.course.id, i.reason])).toEqual([
      ['b', 'unknown-category'],
      ['c', 'invalid-credits'],
      ['d', 'invalid-credits'],
      ['e', 'invalid-credits'],
      ['f', 'invalid-credits'],
    ]);
  });
});

describe('addHypotheticalCourses', () => {
  it('returns a copy and leaves the original plan untouched', () => {
    const original = [course({ id: 'c1' })];
    const snapshot = JSON.parse(JSON.stringify(original));
    const next = addHypotheticalCourses(categories, original, [hypo('h1', 3, 'genEd')]);
    expect(next).toHaveLength(2);
    expect(next).not.toBe(original);
    expect(next[0]).not.toBe(original[0]);
    expect(original).toEqual(snapshot);
    expect(next[1]).toMatchObject({ credits: 3, categoryId: 'genEd', status: 'completed' });
  });

  it('leaves out hypothetical courses that cannot count', () => {
    const next = addHypotheticalCourses(categories, [], [hypo('h1', 3, 'gone')]);
    expect(next).toEqual([]);
  });
});

describe('projectWhatIf', () => {
  it('reports where the student lands and the change versus now', () => {
    const courses = [course({ credits: 4, status: 'completed' })];
    const result = projectWhatIf(categories, courses, [
      hypo('a', 4, 'core'),
      hypo('b', 3, 'genEd'),
    ]);
    expect(result.before).toEqual({
      creditsRequired: 21,
      creditsCompleted: 4,
      creditsInProgress: 0,
      creditsExtra: 0,
    });
    expect(result.after.creditsCompleted).toBe(11);
    expect(result.creditsGained).toBe(7);
    expect(result.extraGained).toBe(0);
    const coreChange = result.categories.find((c) => c.category.id === 'core')!;
    expect(coreChange).toMatchObject({ earnedBefore: 4, earnedAfter: 8, remainingAfter: 4 });
    const genEdChange = result.categories.find((c) => c.category.id === 'genEd')!;
    expect(genEdChange).toMatchObject({ earnedBefore: 0, earnedAfter: 3, remainingAfter: 6 });
    expect(result.completeAfter).toBe(false);
    expect(result.shortfallsAfter).toEqual([
      { name: 'General Education', credits: 6 },
      { name: 'Major Core', credits: 4 },
    ]);
    expect(result.creditsUnplannedAfter).toBe(10);
  });

  it('does not count credits past a category cap twice or let them cover another category', () => {
    const courses = [course({ credits: 10, status: 'completed' })];
    const result = projectWhatIf(categories, courses, [hypo('a', 6, 'core')]);
    // Major Core asks for 12: 10 earned, 6 more is 16 -> 12 count, 4 extra.
    expect(result.after.creditsCompleted).toBe(12);
    expect(result.after.creditsExtra).toBe(4);
    expect(result.creditsGained).toBe(2);
    expect(result.extraGained).toBe(4);
    const coreChange = result.categories.find((c) => c.category.id === 'core')!;
    expect(coreChange).toMatchObject({ earnedAfter: 12, extraBefore: 0, extraAfter: 4 });
    // The surplus does not reduce General Education's gap.
    expect(result.shortfallsAfter).toEqual([{ name: 'General Education', credits: 9 }]);
  });

  it('shows a degree that is already complete as unchanged by extra courses', () => {
    const courses = [
      course({ credits: 12, categoryId: 'core' }),
      course({ credits: 9, categoryId: 'genEd' }),
    ];
    const result = projectWhatIf(categories, courses, [hypo('a', 3, 'core')]);
    expect(result.before.creditsCompleted).toBe(21);
    expect(result.after.creditsCompleted).toBe(21);
    expect(result.creditsGained).toBe(0);
    expect(result.extraGained).toBe(3);
    expect(result.completeAfter).toBe(true);
    expect(result.shortfallsAfter).toEqual([]);
    expect(result.creditsUnplannedAfter).toBe(0);
  });

  it('is a no-op with no hypothetical courses', () => {
    const courses = [course({ credits: 4 })];
    const result = projectWhatIf(categories, courses, []);
    expect(result.after).toEqual(result.before);
    expect(result.creditsGained).toBe(0);
    expect(result.extraGained).toBe(0);
    expect(result.counted).toEqual([]);
    expect(result.ignored).toEqual([]);
  });

  it('counts nothing for a category id the profile does not have', () => {
    const result = projectWhatIf(categories, [], [hypo('a', 6, 'gone')]);
    expect(result.after.creditsCompleted).toBe(0);
    expect(result.creditsGained).toBe(0);
    expect(result.counted).toEqual([]);
    expect(result.ignored).toHaveLength(1);
    expect(result.ignored[0].reason).toBe('unknown-category');
  });

  it('adds fractional credits without floating point noise', () => {
    const result = projectWhatIf(
      categories,
      [course({ credits: 0.1 })],
      [hypo('a', 0.2, 'core'), hypo('b', 1.5, 'core')],
    );
    expect(result.before.creditsCompleted).toBe(0.1);
    expect(result.after.creditsCompleted).toBe(1.8);
    expect(result.creditsGained).toBe(1.7);
    expect(result.categories[0].remainingAfter).toBe(10.2);
  });

  it('counts in-progress and completed credits as before, and ignores planned ones for progress', () => {
    const courses = [
      course({ credits: 3, status: 'in-progress' }),
      course({ credits: 3, status: 'planned' }),
    ];
    const result = projectWhatIf(categories, courses, [hypo('a', 3, 'core')]);
    expect(result.before.creditsInProgress).toBe(3);
    expect(result.after.creditsCompleted).toBe(3);
    expect(result.after.creditsInProgress).toBe(3);
    // The planned course still covers part of Major Core's gap.
    expect(result.shortfallsAfter).toEqual([
      { name: 'General Education', credits: 9 },
      { name: 'Major Core', credits: 3 },
    ]);
  });

  it('handles a profile with no categories', () => {
    const result = projectWhatIf([], [], [hypo('a', 3, 'core')]);
    expect(result.after.creditsRequired).toBe(0);
    expect(result.categories).toEqual([]);
    expect(result.ignored).toHaveLength(1);
    expect(result.completeAfter).toBe(true);
  });
});

describe('planTerms', () => {
  it('packs the remaining credits into the fewest terms, biggest shortfall first', () => {
    const plan = planTerms(
      [
        { name: 'Major Core', credits: 12 },
        { name: 'General Education', credits: 20 },
        { name: 'Electives', credits: 7 },
      ],
      15,
    );
    expect(plan.problem).toBeNull();
    expect(plan.totalCredits).toBe(39);
    expect(plan.terms.map((t) => t.credits)).toEqual([15, 15, 9]);
    expect(plan.terms[0].items).toEqual([{ name: 'General Education', credits: 15 }]);
    expect(plan.terms[1].items).toEqual([
      { name: 'General Education', credits: 5 },
      { name: 'Major Core', credits: 10 },
    ]);
    expect(plan.terms[2].items).toEqual([
      { name: 'Major Core', credits: 2 },
      { name: 'Electives', credits: 7 },
    ]);
    expect(plan.terms.map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it('schedules every credit exactly once', () => {
    const shortfalls = [
      { name: 'A', credits: 7 },
      { name: 'B', credits: 7 },
      { name: 'C', credits: 7 },
    ];
    const plan = planTerms(shortfalls, 6);
    const perName = new Map<string, number>();
    for (const term of plan.terms) {
      expect(term.credits).toBeLessThanOrEqual(6);
      for (const item of term.items) {
        perName.set(item.name, (perName.get(item.name) ?? 0) + item.credits);
      }
    }
    expect([...perName.entries()].sort()).toEqual([
      ['A', 7],
      ['B', 7],
      ['C', 7],
    ]);
    expect(plan.terms).toHaveLength(4);
  });

  it('is deterministic regardless of input order for equal shortfalls', () => {
    const a = planTerms(
      [
        { name: 'B', credits: 5 },
        { name: 'A', credits: 5 },
      ],
      6,
    );
    const b = planTerms(
      [
        { name: 'A', credits: 5 },
        { name: 'B', credits: 5 },
      ],
      6,
    );
    expect(a).toEqual(b);
    expect(a.terms[0].items[0].name).toBe('A');
  });

  it('returns no terms when there is nothing left to schedule', () => {
    expect(planTerms([], 15)).toEqual({
      terms: [],
      totalCredits: 0,
      maxCreditsPerTerm: 15,
      problem: null,
    });
  });

  it('skips zero, negative and non-finite shortfalls', () => {
    const plan = planTerms(
      [
        { name: 'Done', credits: 0 },
        { name: 'Bad', credits: -3 },
        { name: 'Nan', credits: Number.NaN },
        { name: 'Real', credits: 3 },
      ],
      15,
    );
    expect(plan.terms).toHaveLength(1);
    expect(plan.terms[0].items).toEqual([{ name: 'Real', credits: 3 }]);
  });

  it('fits everything in one term when the cap is larger than the total', () => {
    const plan = planTerms([{ name: 'A', credits: 4 }], 18);
    expect(plan.terms).toHaveLength(1);
    expect(plan.terms[0].credits).toBe(4);
  });

  it('treats credits as divisible when the cap is smaller than one course', () => {
    // A 3-credit course cannot really be split, but the planner works in
    // credits: 2 per term over 2 terms covers a 3-credit need.
    const plan = planTerms([{ name: 'A', credits: 3 }], 2);
    expect(plan.terms.map((t) => t.credits)).toEqual([2, 1]);
  });

  it('rejects a cap that is not a positive number', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 0.0004]) {
      const plan = planTerms([{ name: 'A', credits: 3 }], bad);
      expect(plan.problem).toBe('invalid-max');
      expect(plan.terms).toEqual([]);
    }
  });

  it('refuses to build an enormous plan from a tiny cap', () => {
    const plan = planTerms([{ name: 'A', credits: 100 }], 0.5);
    expect(plan.problem).toBe('too-many-terms');
    expect(plan.terms).toEqual([]);
    expect(plan.totalCredits).toBe(100);
    // Right at the limit still plans.
    const atLimit = planTerms([{ name: 'A', credits: MAX_PLANNED_TERMS }], 1);
    expect(atLimit.problem).toBeNull();
    expect(atLimit.terms).toHaveLength(MAX_PLANNED_TERMS);
  });

  it('handles fractional credits without leftover slivers', () => {
    const plan = planTerms(
      [
        { name: 'A', credits: 0.1 },
        { name: 'B', credits: 0.2 },
      ],
      0.3,
    );
    expect(plan.terms).toHaveLength(1);
    expect(plan.terms[0].credits).toBe(0.3);
    const half = planTerms([{ name: 'A', credits: 7.5 }], 2.5);
    expect(half.terms.map((t) => t.credits)).toEqual([2.5, 2.5, 2.5]);
  });

  it('does not modify its input', () => {
    const shortfalls = [{ name: 'A', credits: 7 }];
    planTerms(shortfalls, 3);
    expect(shortfalls).toEqual([{ name: 'A', credits: 7 }]);
  });
});
