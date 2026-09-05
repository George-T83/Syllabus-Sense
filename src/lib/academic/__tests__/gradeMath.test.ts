import { describe, it, expect } from 'vitest';
import {
  percentageToLetterGrade,
  letterGradeToGpaPoints,
  calculateCurrentWeightedGrade,
  calculateRequiredFinalScore,
  calculateSemesterGpa,
  deriveCategoriesFromScheduleItems,
  GradeCategory,
} from '../gradeMath';
import type { ScheduleItem } from '@/types/schedule';

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: overrides.id ?? 'item',
    courseId: 'course-1',
    title: 'Item',
    type: 'assignment',
    dueDate: '2026-09-10',
    completed: true,
    ...overrides,
  };
}

describe('Academic Grade Math (Item 36)', () => {
  it('converts percentages to letter grades correctly across boundaries', () => {
    expect(percentageToLetterGrade(95.0)).toBe('A');
    expect(percentageToLetterGrade(93.0)).toBe('A');
    expect(percentageToLetterGrade(92.9)).toBe('A-');
    expect(percentageToLetterGrade(90.0)).toBe('A-');
    expect(percentageToLetterGrade(87.5)).toBe('B+');
    expect(percentageToLetterGrade(83.0)).toBe('B');
    expect(percentageToLetterGrade(73.5)).toBe('C');
    expect(percentageToLetterGrade(60.0)).toBe('D');
    expect(percentageToLetterGrade(59.9)).toBe('F');
    expect(percentageToLetterGrade(-5)).toBe('F');
  });

  it('maps letter grades to 4.0 quality points accurately', () => {
    expect(letterGradeToGpaPoints('A')).toBe(4.0);
    expect(letterGradeToGpaPoints('A-')).toBe(3.7);
    expect(letterGradeToGpaPoints('B+')).toBe(3.3);
    expect(letterGradeToGpaPoints('B')).toBe(3.0);
    expect(letterGradeToGpaPoints('B-')).toBe(2.7);
    expect(letterGradeToGpaPoints('C+')).toBe(2.3);
    expect(letterGradeToGpaPoints('C')).toBe(2.0);
    expect(letterGradeToGpaPoints('C-')).toBe(1.7);
    expect(letterGradeToGpaPoints('D')).toBe(1.0);
    expect(letterGradeToGpaPoints('F')).toBe(0.0);
  });

  it('calculates weighted current grade with normalized categories', () => {
    const categories: GradeCategory[] = [
      { name: 'Homework', weight: 20, score: 95 },
      { name: 'Midterm 1', weight: 20, score: 85 },
      { name: 'Midterm 2', weight: 20, score: 90 },
    ];
    // Total evaluated weight = 60
    // Weighted points = (95*0.2 + 85*0.2 + 90*0.2) = 19 + 17 + 18 = 54
    // Normalized = 54 / 0.6 = 90.0% ('A-')
    const res = calculateCurrentWeightedGrade(categories);
    expect(res.currentPercentage).toBe(90.0);
    expect(res.letterGrade).toBe('A-');
    expect(res.gpaPoints).toBe(3.7);
    expect(res.totalCompletedWeight).toBe(60);
  });

  it('solves final exam target scores with precision', () => {
    // Current: Homework (25% weight, score 92%), Midterm (25% weight, score 84%), Projects (20% weight, score 95%)
    // Remaining: Final Exam (30% weight)
    // Non-final points = 92*0.25 + 84*0.25 + 95*0.20 = 23 + 21 + 19 = 63.0 points out of 70%
    // Target A (93.0% overall = 93 points out of 100)
    // Points needed from final = 93 - 63 = 30 points
    // Required Final Exam Score = 30 / 0.30 = 100.0%
    const categories: GradeCategory[] = [
      { name: 'Homework', weight: 25, score: 92 },
      { name: 'Midterm', weight: 25, score: 84 },
      { name: 'Projects', weight: 20, score: 95 },
    ];

    const result = calculateRequiredFinalScore(categories, 30, 93.0);
    expect(result.requiredFinalScore).toBe(100.0);
    expect(result.isAchievable).toBe(true);
    expect(result.status).toBe('challenging');
  });

  it('flags mathematically impossible target goals (>100% required)', () => {
    const categories: GradeCategory[] = [
      { name: 'Midterm 1', weight: 35, score: 60 },
      { name: 'Midterm 2', weight: 35, score: 65 },
    ];
    // Final is 30% weight, target 93%
    const result = calculateRequiredFinalScore(categories, 30, 93.0);
    expect(result.requiredFinalScore).toBeGreaterThan(100);
    expect(result.isAchievable).toBe(false);
    expect(result.status).toBe('impossible');
  });

  it('detects already achieved / guaranteed grades (<=0% required on final)', () => {
    const categories: GradeCategory[] = [{ name: 'Coursework', weight: 90, score: 98 }];
    // Final is 10% weight, target 70% (C-)
    const result = calculateRequiredFinalScore(categories, 10, 70.0);
    expect(result.requiredFinalScore).toBeLessThanOrEqual(0);
    expect(result.isGuaranteed).toBe(true);
    expect(result.status).toBe('already_achieved');
  });

  it('calculates semester GPA with credit hour weighting and 0-credit defenses', () => {
    const courses = [
      { credits: 4, percentage: 95 }, // A (4.0 * 4 = 16.0)
      { credits: 3, percentage: 85 }, // B (3.0 * 3 = 9.0)
      { credits: 3, percentage: 91 }, // A- (3.7 * 3 = 11.1)
      { credits: 0, percentage: 100 }, // 0-credit lab ignored in GPA math
    ];
    // Total credits = 10
    // Total quality points = 16.0 + 9.0 + 11.1 = 36.1
    // GPA = 36.1 / 10 = 3.61
    const result = calculateSemesterGpa(courses);
    expect(result.totalCredits).toBe(10);
    expect(result.gpa).toBe(3.61);
    expect(result.qualityPoints).toBe(36.1);
  });

  it('derives grade categories from graded schedule items, grouped by category', () => {
    const items: ScheduleItem[] = [
      item({ id: 'a', gradeCategory: 'Homework', gradeWeight: 10, earnedScore: 90 }),
      item({ id: 'b', gradeCategory: 'Homework', gradeWeight: 10, earnedScore: 80 }),
      item({ id: 'c', gradeCategory: 'Exams', gradeWeight: 30, earnedScore: 88 }),
    ];

    const categories = deriveCategoriesFromScheduleItems(items);

    const homework = categories.find((c) => c.name === 'Homework');
    const exams = categories.find((c) => c.name === 'Exams');
    expect(homework?.weight).toBe(20);
    // (10*90 + 10*80) / 20 = 85
    expect(homework?.score).toBe(85);
    expect(exams?.weight).toBe(30);
    expect(exams?.score).toBe(88);
  });

  it('excludes items missing a weight or score, and falls back to "Other" for an uncategorized item', () => {
    const items: ScheduleItem[] = [
      item({ id: 'no-score', gradeCategory: 'Homework', gradeWeight: 10 }),
      item({ id: 'no-weight', gradeCategory: 'Homework', earnedScore: 90 }),
      item({ id: 'uncategorized', gradeWeight: 15, earnedScore: 70 }),
    ];

    const categories = deriveCategoriesFromScheduleItems(items);

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('Other');
    expect(categories[0].weight).toBe(15);
    expect(categories[0].score).toBe(70);
  });

  it('returns an empty array when no schedule items have both a weight and a score', () => {
    expect(deriveCategoriesFromScheduleItems([])).toEqual([]);
    expect(
      deriveCategoriesFromScheduleItems([item({ id: 'ungraded', gradeCategory: 'Homework' })]),
    ).toEqual([]);
  });
});
