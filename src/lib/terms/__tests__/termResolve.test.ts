import { describe, it, expect } from 'vitest';
import {
  courseInTerm,
  courseTerm,
  courseTermLabel,
  findTermByLabel,
  inferCurrentTerm,
  resolveActiveTerm,
  sortTerms,
  termFields,
} from '../termResolve';
import type { Term } from '@/types/term';

const fall: Term = {
  id: 't-fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};
const spring: Term = {
  id: 't-spring',
  label: 'Spring 2027',
  startDate: '2027-01-12',
  endDate: '2027-05-15',
};
const terms = [spring, fall];

describe('courseTerm', () => {
  it('follows termId', () => {
    expect(courseTerm({ termId: 't-fall', term: 'something else' }, terms)).toBe(fall);
  });
  it('falls back to the label for a course that is not linked yet', () => {
    expect(courseTerm({ term: ' fall  2026' }, terms)).toBe(fall);
  });
  it('is undefined for a course with no term, or a label no term has', () => {
    expect(courseTerm({}, terms)).toBeUndefined();
    expect(courseTerm({ term: 'Winter 2027' }, terms)).toBeUndefined();
  });
  it('ignores a termId that no longer exists and uses the label', () => {
    expect(courseTerm({ termId: 'gone', term: 'Spring 2027' }, terms)).toBe(spring);
  });
});

describe('courseInTerm and courseTermLabel', () => {
  it('matches by term object', () => {
    expect(courseInTerm({ termId: 't-fall' }, fall, terms)).toBe(true);
    expect(courseInTerm({ termId: 't-spring' }, fall, terms)).toBe(false);
  });
  it('shows the term label, or the courses own label when it has no term object', () => {
    expect(courseTermLabel({ termId: 't-fall', term: 'stale' }, terms)).toBe('Fall 2026');
    expect(courseTermLabel({ term: 'Winter 2027' }, terms)).toBe('Winter 2027');
    expect(courseTermLabel({}, terms)).toBeUndefined();
  });
});

describe('termFields', () => {
  it('gives the link plus the label, or nothing', () => {
    expect(termFields(fall)).toEqual({ termId: 't-fall', term: 'Fall 2026' });
    expect(termFields(null)).toEqual({});
  });
});

describe('sortTerms', () => {
  it('orders by first day', () => {
    expect(sortTerms(terms).map((t) => t.id)).toEqual(['t-fall', 't-spring']);
  });
});

describe('inferCurrentTerm', () => {
  it('returns the term most courses belong to', () => {
    const courses = [{ termId: 't-fall' }, { termId: 't-fall' }, { termId: 't-spring' }];
    expect(inferCurrentTerm(courses, terms)).toBe(fall);
  });
  it('counts unlinked courses through their label', () => {
    expect(
      inferCurrentTerm(
        [{ term: 'Spring 2027' }, { term: 'spring 2027' }, { termId: 't-fall' }],
        terms,
      ),
    ).toBe(spring);
  });
  it('is null when no course has a known term, or there are no courses', () => {
    expect(inferCurrentTerm([{}, { term: 'Winter 2027' }], terms)).toBeNull();
    expect(inferCurrentTerm([], terms)).toBeNull();
  });
});

describe('resolveActiveTerm', () => {
  const courses = [{ termId: 't-fall' }, { termId: 't-fall' }, { termId: 't-spring' }];
  it('is null (every term) when the student chose "all"', () => {
    expect(resolveActiveTerm('all', courses, terms)).toBeNull();
  });
  it('returns the chosen term by id', () => {
    expect(resolveActiveTerm('t-spring', courses, terms)).toBe(spring);
  });
  it('understands a label saved by an older version', () => {
    expect(resolveActiveTerm('Spring 2027', courses, terms)).toBe(spring);
  });
  it('infers the term when nothing was chosen, or the choice no longer exists', () => {
    expect(resolveActiveTerm(null, courses, terms)).toBe(fall);
    expect(resolveActiveTerm('deleted-term', courses, terms)).toBe(fall);
  });
  it('is null when there are no terms', () => {
    expect(resolveActiveTerm(null, [{ term: 'Fall 2026' }], [])).toBeNull();
  });
});

describe('findTermByLabel', () => {
  it('ignores case and spacing and never matches a blank', () => {
    expect(findTermByLabel(terms, 'FALL 2026')).toBe(fall);
    expect(findTermByLabel(terms, '   ')).toBeUndefined();
  });
});
