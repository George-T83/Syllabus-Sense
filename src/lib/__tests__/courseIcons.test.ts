import { describe, it, expect } from 'vitest';
import {
  resolveCourseIcon,
  pickSuggestedCourseIcon,
  DEFAULT_COURSE_ICON,
  COURSE_ICON_PRESETS,
} from '@/lib/courseIcons';

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
  it('uses a valid AI suggestion as-is when nothing else this term has it', () => {
    expect(pickSuggestedCourseIcon([], 'Fall 2026', 'calculator')).toBe('calculator');
  });

  it('falls back to the default when the suggestion is missing or invalid', () => {
    expect(pickSuggestedCourseIcon([], 'Fall 2026', null)).toBe(DEFAULT_COURSE_ICON);
    expect(pickSuggestedCourseIcon([], 'Fall 2026', undefined)).toBe(DEFAULT_COURSE_ICON);
    expect(pickSuggestedCourseIcon([], 'Fall 2026', 'not-a-real-icon')).toBe(DEFAULT_COURSE_ICON);
  });

  it('steers away from an icon another course this term already uses, toward a free one', () => {
    const existing = [{ icon: 'calculator', term: 'Fall 2026' }];
    const picked = pickSuggestedCourseIcon(existing, 'Fall 2026', 'calculator');
    expect(picked).not.toBe('calculator');
  });

  it('keeps the suggestion when the only collision is in a different term', () => {
    const existing = [{ icon: 'calculator', term: 'Spring 2026' }];
    expect(pickSuggestedCourseIcon(existing, 'Fall 2026', 'calculator')).toBe('calculator');
  });

  it('is only a soft preference: keeps the suggestion once every preset is already taken', () => {
    const existing = COURSE_ICON_PRESETS.map((p) => ({ icon: p.value, term: 'Fall 2026' }));
    expect(pickSuggestedCourseIcon(existing, 'Fall 2026', 'calculator')).toBe('calculator');
  });
});
