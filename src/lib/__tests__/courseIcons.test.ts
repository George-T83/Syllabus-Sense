import { describe, it, expect } from 'vitest';
import { resolveCourseIcon, pickSuggestedCourseIcon, DEFAULT_COURSE_ICON } from '@/lib/courseIcons';

describe('resolveCourseIcon', () => {
  it('passes through a recognized preset', () => {
    expect(resolveCourseIcon('flask')).toBe('flask');
  });

  it('falls back to the default for undefined, unknown, or empty values', () => {
    expect(resolveCourseIcon(undefined)).toBe(DEFAULT_COURSE_ICON);
    expect(resolveCourseIcon('not-a-real-icon')).toBe(DEFAULT_COURSE_ICON);
    expect(resolveCourseIcon('')).toBe(DEFAULT_COURSE_ICON);
  });
});

describe('pickSuggestedCourseIcon', () => {
  it('uses a valid AI suggestion as-is', () => {
    expect(pickSuggestedCourseIcon('calculator')).toBe('calculator');
  });

  it('falls back to the default when the suggestion is missing or invalid', () => {
    expect(pickSuggestedCourseIcon(null)).toBe(DEFAULT_COURSE_ICON);
    expect(pickSuggestedCourseIcon(undefined)).toBe(DEFAULT_COURSE_ICON);
    expect(pickSuggestedCourseIcon('not-a-real-icon')).toBe(DEFAULT_COURSE_ICON);
  });
});
