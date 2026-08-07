import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('joins string classes together', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar');
  });

  it('supports conditional object arguments', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar');
  });

  it('returns empty string if no valid inputs are given', () => {
    expect(cn(null, undefined, false)).toBe('');
  });
});
