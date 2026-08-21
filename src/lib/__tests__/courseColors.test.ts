import { describe, it, expect } from 'vitest';
import { pickSuggestedCourseColor, pickNextCourseColor } from '@/lib/courseColors';

describe('pickSuggestedCourseColor', () => {
  it('uses a valid AI suggestion as-is when nothing else this term has it', () => {
    expect(pickSuggestedCourseColor([], 'Fall 2026', 'bg-teal-500')).toBe('bg-teal-500');
  });

  it('falls back to the least-used preset when the suggestion is missing or invalid', () => {
    expect(pickSuggestedCourseColor([], 'Fall 2026', null)).toBe(pickNextCourseColor([]));
    expect(pickSuggestedCourseColor([], 'Fall 2026', 'not-a-real-color')).toBe(
      pickNextCourseColor([]),
    );
  });

  it('avoids a color another course this term already uses', () => {
    const existing = [{ color: 'bg-teal-500', term: 'Fall 2026' }];
    expect(pickSuggestedCourseColor(existing, 'Fall 2026', 'bg-teal-500')).not.toBe('bg-teal-500');
  });

  it('keeps the suggestion when the only collision is in a different term', () => {
    const existing = [{ color: 'bg-teal-500', term: 'Spring 2026' }];
    expect(pickSuggestedCourseColor(existing, 'Fall 2026', 'bg-teal-500')).toBe('bg-teal-500');
  });

  it('falls back to comparing against everything when the term is unknown', () => {
    const existing = [{ color: 'bg-blue-500', term: 'Fall 2026' }];
    expect(pickSuggestedCourseColor(existing, undefined, 'bg-blue-500')).not.toBe('bg-blue-500');
  });
});
