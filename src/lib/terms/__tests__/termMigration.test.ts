import { describe, it, expect } from 'vitest';
import { isEmptyPlan, planTermMigration, termIdForLabel } from '../termMigration';
import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';

function course(id: string, extra: Partial<Course> = {}): Course {
  return { id, code: id.toUpperCase(), title: id, ...extra } as Course;
}

describe('termIdForLabel', () => {
  it('is the same for the same label whatever its case and spacing, and differs between labels', () => {
    expect(termIdForLabel('Fall 2026')).toBe(termIdForLabel('  fall   2026'));
    expect(termIdForLabel('Fall 2026')).not.toBe(termIdForLabel('Spring 2027'));
    expect(termIdForLabel('Fall-2026')).not.toBe(termIdForLabel('Fall 2026'));
  });
});

describe('planTermMigration', () => {
  it('creates a term with the standard dates for each known label and links its courses', () => {
    const plan = planTermMigration(
      [
        course('a', { term: 'Fall 2026' }),
        course('b', { term: 'fall 2026' }),
        course('c', { term: 'Spring 2027' }),
      ],
      [],
    );
    expect(plan.newTerms).toEqual([
      {
        id: termIdForLabel('Fall 2026'),
        label: 'Fall 2026',
        startDate: '2026-08-24',
        endDate: '2026-12-18',
      },
      {
        id: termIdForLabel('Spring 2027'),
        label: 'Spring 2027',
        startDate: '2027-01-12',
        endDate: '2027-05-15',
      },
    ]);
    expect(plan.courseLinks).toEqual([
      { courseId: 'a', termId: termIdForLabel('Fall 2026') },
      { courseId: 'b', termId: termIdForLabel('Fall 2026') },
      { courseId: 'c', termId: termIdForLabel('Spring 2027') },
    ]);
    expect(plan.unknownLabels).toEqual([]);
  });

  it('asks about a label with no standard dates instead of guessing, once however many courses use it', () => {
    const plan = planTermMigration(
      [
        course('a', { term: 'Winter 2027' }),
        course('b', { term: 'winter 2027' }),
        course('c', { term: 'Block 3' }),
      ],
      [],
    );
    expect(plan.unknownLabels).toEqual(['Winter 2027', 'Block 3']);
    expect(plan.newTerms).toEqual([]);
    expect(plan.courseLinks).toEqual([]);
  });

  it('uses a term the student already stored rather than creating one, and never re-dates it', () => {
    const mine: Term = {
      id: 'mine',
      label: 'Fall 2026',
      startDate: '2026-09-01',
      endDate: '2026-12-10',
    };
    const plan = planTermMigration([course('a', { term: 'Fall 2026' })], [mine]);
    expect(plan.newTerms).toEqual([]);
    expect(plan.courseLinks).toEqual([{ courseId: 'a', termId: 'mine' }]);
  });

  it('links a label the student has since given dates to', () => {
    const winter: Term = {
      id: 'w',
      label: 'Winter 2027',
      startDate: '2027-01-04',
      endDate: '2027-03-19',
    };
    const plan = planTermMigration([course('a', { term: 'Winter 2027' })], [winter]);
    expect(plan.courseLinks).toEqual([{ courseId: 'a', termId: 'w' }]);
    expect(plan.unknownLabels).toEqual([]);
  });

  it('leaves linked courses, and courses with no term, alone', () => {
    const fall: Term = {
      id: 'f',
      label: 'Fall 2026',
      startDate: '2026-08-24',
      endDate: '2026-12-18',
    };
    const plan = planTermMigration(
      [course('a', { term: 'Fall 2026', termId: 'f' }), course('b'), course('c', { term: '   ' })],
      [fall],
    );
    expect(isEmptyPlan(plan)).toBe(true);
    expect(plan.unknownLabels).toEqual([]);
  });

  it('treats a link to a term that is gone like an unlinked course', () => {
    const plan = planTermMigration([course('a', { term: 'Fall 2026', termId: 'gone' })], []);
    expect(plan.newTerms).toHaveLength(1);
    expect(plan.courseLinks).toEqual([{ courseId: 'a', termId: termIdForLabel('Fall 2026') }]);
  });

  it('is empty once everything is linked (running it again changes nothing)', () => {
    const first = planTermMigration([course('a', { term: 'Fall 2026' })], []);
    const second = planTermMigration(
      [course('a', { term: 'Fall 2026', termId: first.courseLinks[0].termId })],
      first.newTerms,
    );
    expect(isEmptyPlan(second)).toBe(true);
  });
});
