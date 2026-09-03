import { describe, it, expect } from 'vitest';
import { normalizeMaterials, sumMaterialCosts, sumAllCourseMaterialCosts } from '../materials';
import type { Course } from '@/types/schedule';

describe('normalizeMaterials', () => {
  it('wraps legacy plain strings into MaterialItem objects', () => {
    expect(normalizeMaterials(['Lab goggles'])).toEqual([{ name: 'Lab goggles' }]);
  });

  it('passes MaterialItem objects through unchanged', () => {
    const item = { name: 'Textbook', cost: 89.99 };
    expect(normalizeMaterials([item])).toEqual([item]);
  });

  it('handles a mix of legacy strings and new objects in the same list', () => {
    expect(normalizeMaterials(['Lab goggles', { name: 'Textbook', cost: 89.99 }])).toEqual([
      { name: 'Lab goggles' },
      { name: 'Textbook', cost: 89.99 },
    ]);
  });

  it('returns an empty array for undefined or non-array input', () => {
    expect(normalizeMaterials(undefined)).toEqual([]);
    expect(normalizeMaterials(null)).toEqual([]);
  });
});

describe('sumMaterialCosts', () => {
  it('sums only materials that have a cost recorded', () => {
    const materials = [
      { name: 'Textbook', cost: 89.99 },
      { name: 'Lab goggles', cost: 12.5 },
      { name: 'Free syllabus PDF' },
    ];
    expect(sumMaterialCosts(materials)).toBeCloseTo(102.49);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMaterialCosts([])).toBe(0);
  });
});

describe('sumAllCourseMaterialCosts', () => {
  it('sums costs across multiple courses, normalizing legacy strings along the way', () => {
    // Deliberately simulates a pre-cost-field Firestore document still
    // holding a plain string entry - normalizeMaterials() is what makes
    // this safe to read despite the stricter MaterialItem[] type.
    const courses = [
      { materials: [{ name: 'Textbook', cost: 89.99 }, 'Lab goggles'] },
      { materials: [{ name: 'Calculator', cost: 120 }] },
      { materials: undefined },
    ] as unknown as Pick<Course, 'materials'>[];
    expect(sumAllCourseMaterialCosts(courses)).toBeCloseTo(209.99);
  });
});
