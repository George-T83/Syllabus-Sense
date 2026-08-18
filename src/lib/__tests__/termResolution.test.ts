import { describe, it, expect } from 'vitest';
import { inferCurrentTerm, resolveActiveTerm } from '@/context/AppStateContext';

describe('inferCurrentTerm', () => {
  it('returns the term shared by the most courses', () => {
    const courses = [{ term: 'Fall 2026' }, { term: 'Fall 2026' }, { term: 'Spring 2027' }];
    expect(inferCurrentTerm(courses)).toBe('Fall 2026');
  });

  it('returns null when no course has a term', () => {
    expect(inferCurrentTerm([{ term: undefined }, {}])).toBeNull();
  });

  it('returns null for an empty course list', () => {
    expect(inferCurrentTerm([])).toBeNull();
  });
});

describe('resolveActiveTerm', () => {
  const courses = [{ term: 'Fall 2026' }, { term: 'Fall 2026' }, { term: 'Spring 2027' }];

  it('returns null (no filter) when the user explicitly chose "all"', () => {
    expect(resolveActiveTerm('all', courses)).toBeNull();
  });

  it('returns the explicit term when one is selected', () => {
    expect(resolveActiveTerm('Spring 2027', courses)).toBe('Spring 2027');
  });

  it('falls back to inferCurrentTerm when nothing has been explicitly chosen', () => {
    expect(resolveActiveTerm(null, courses)).toBe('Fall 2026');
  });
});
