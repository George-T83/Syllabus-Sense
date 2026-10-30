import { describe, it, expect } from 'vitest';
import { inferCurrentTerm, resolveActiveTerm } from '@/lib/terms/termResolve';
import type { Term } from '@/types/term';

const fall: Term = {
  id: 'fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};
const spring: Term = {
  id: 'spring',
  label: 'Spring 2027',
  startDate: '2027-01-12',
  endDate: '2027-05-15',
};
const terms = [fall, spring];

describe('inferCurrentTerm', () => {
  it('returns the term shared by the most courses', () => {
    const courses = [{ termId: 'fall' }, { termId: 'fall' }, { termId: 'spring' }];
    expect(inferCurrentTerm(courses, terms)).toBe(fall);
  });

  it('returns null when no course has a term', () => {
    expect(inferCurrentTerm([{ term: undefined }, {}], terms)).toBeNull();
  });

  it('returns null for an empty course list', () => {
    expect(inferCurrentTerm([], terms)).toBeNull();
  });
});

describe('resolveActiveTerm', () => {
  const courses = [{ termId: 'fall' }, { termId: 'fall' }, { termId: 'spring' }];

  it('returns null (no filter) when the user explicitly chose "all"', () => {
    expect(resolveActiveTerm('all', courses, terms)).toBeNull();
  });

  it('returns the explicit term when one is selected', () => {
    expect(resolveActiveTerm('spring', courses, terms)).toBe(spring);
  });

  it('falls back to inferCurrentTerm when nothing has been explicitly chosen', () => {
    expect(resolveActiveTerm(null, courses, terms)).toBe(fall);
  });
});
