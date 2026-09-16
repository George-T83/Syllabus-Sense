import { describe, it, expect } from 'vitest';
import { estimateReadingHours } from '../estimateReadingHours';

describe('estimateReadingHours', () => {
  it('returns 0 for zero, negative, or non-finite page counts', () => {
    expect(estimateReadingHours(0)).toBe(0);
    expect(estimateReadingHours(-5)).toBe(0);
    expect(estimateReadingHours(NaN)).toBe(0);
  });

  it('estimates standard density at ~25 pages/hour', () => {
    expect(estimateReadingHours(25, 'standard')).toBe(1);
    expect(estimateReadingHours(50, 'standard')).toBe(2);
  });

  it('estimates light density faster than standard for the same page count', () => {
    const light = estimateReadingHours(50, 'light');
    const standard = estimateReadingHours(50, 'standard');
    expect(light).toBeLessThan(standard);
  });

  it('estimates dense reading slower than standard for the same page count', () => {
    const dense = estimateReadingHours(50, 'dense');
    const standard = estimateReadingHours(50, 'standard');
    expect(dense).toBeGreaterThan(standard);
  });

  it('defaults to standard density when none is given', () => {
    expect(estimateReadingHours(25)).toBe(estimateReadingHours(25, 'standard'));
  });

  it('rounds to the nearest quarter hour', () => {
    // 10 pages at 25/hr = 0.4h -> rounds to 0.5h
    expect(estimateReadingHours(10, 'standard')).toBe(0.5);
    // 12 pages at 25/hr = 0.48h -> rounds to 0.5h
    expect(estimateReadingHours(12, 'standard')).toBe(0.5);
  });

  it('never goes below a quarter-hour floor for any positive page count', () => {
    expect(estimateReadingHours(1, 'light')).toBe(0.25);
  });
});
