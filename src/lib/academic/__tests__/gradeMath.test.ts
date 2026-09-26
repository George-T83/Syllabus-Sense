import { describe, it, expect } from 'vitest';
import {
  courseStanding,
  percentageToLetterGrade,
  letterGradeToGpaPoints,
  calculateCurrentWeightedGrade,
  calculateGradeFloorCeiling,
  calculateRequiredFinalScore,
  calculateSemesterGpa,
  deriveCategoriesFromScheduleItems,
  projectCourseGrade,
  remainingScoreThresholds,
  remainingWorkFromScheduleItems,
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

describe('calculateGradeFloorCeiling', () => {
  const categories: GradeCategory[] = [
    { id: 'hw', name: 'Homework', weight: 30, score: 90 },
    { id: 'mid', name: 'Midterm', weight: 30, score: 80 },
  ];

  it('computes the floor as a 0% final and the ceiling as a 100% final', () => {
    // nonFinalPoints = 30*0.9 + 30*0.8 = 27 + 24 = 51, totalWeight = 60 + 40 = 100
    const result = calculateGradeFloorCeiling(categories, 40);
    expect(result.floorPercentage).toBe(51);
    expect(result.ceilingPercentage).toBe(91);
    expect(result.floorLetterGrade).toBe('F');
    expect(result.ceilingLetterGrade).toBe('A-');
    expect(result.isLocked).toBe(false);
  });

  it('is locked (floor === ceiling) once there is no final weight left', () => {
    const result = calculateGradeFloorCeiling(categories, 0);
    expect(result.isLocked).toBe(true);
    expect(result.floorPercentage).toBe(result.ceilingPercentage);
  });

  it('returns a zeroed, locked result when there is no weight anywhere', () => {
    const result = calculateGradeFloorCeiling([], 0);
    expect(result).toEqual({
      floorPercentage: 0,
      floorLetterGrade: 'F',
      ceilingPercentage: 0,
      ceilingLetterGrade: 'F',
      isLocked: true,
    });
  });

  it('treats a negative final weight the same as zero, not a subtraction', () => {
    const zero = calculateGradeFloorCeiling(categories, 0);
    const negative = calculateGradeFloorCeiling(categories, -10);
    expect(negative).toEqual(zero);
  });

  it('lets the ceiling exceed 100% when extra credit pushes a category above its max', () => {
    const withExtraCredit: GradeCategory[] = [{ id: 'ec', name: 'Bonus', weight: 50, score: 110 }];
    const result = calculateGradeFloorCeiling(withExtraCredit, 50);
    // nonFinalPoints = 50 * 1.10 = 55, totalWeight = 100, ceiling = (55+50)/100*100 = 105
    expect(result.ceilingPercentage).toBe(105);
    expect(result.ceilingLetterGrade).toBe('A');
  });
});

describe('what-if projection', () => {
  // The CSCI 213 example: 60% of the grade is in, 40% (the final) is left.
  const graded: GradeCategory[] = [
    { name: 'Homework', weight: 20, score: 88.5 },
    { name: 'Exams', weight: 25, score: 78 },
    { name: 'Projects', weight: 15, score: 94 },
  ];

  it('projects the course grade from an average on the remaining work', () => {
    // locked-in points = 17.7 + 19.5 + 14.1 = 51.3 of 60
    expect(projectCourseGrade(graded, 40, 0)).toBeCloseTo(51.3, 2);
    expect(projectCourseGrade(graded, 40, 75)).toBeCloseTo(81.3, 2);
    expect(projectCourseGrade(graded, 40, 100)).toBeCloseTo(91.3, 2);
  });

  it('matches the current standing when nothing is left, and the score when nothing is in', () => {
    expect(projectCourseGrade(graded, 0, 40)).toBeCloseTo(85.5, 2);
    expect(projectCourseGrade([], 100, 72)).toBe(72);
    expect(projectCourseGrade([], 0, 50)).toBe(0);
  });

  it('gives the score needed on what is left for every passing letter', () => {
    const thresholds = remainingScoreThresholds(graded, 40);
    const need = (letter: string) => thresholds.find((t) => t.letter === letter)!.scoreNeeded;
    expect(thresholds.map((t) => t.letter)).toEqual([
      'A',
      'A-',
      'B+',
      'B',
      'B-',
      'C+',
      'C',
      'C-',
      'D+',
      'D',
    ]);
    expect(need('A')).toBeCloseTo(104.25, 0); // out of reach
    expect(need('A-')).toBeCloseTo(96.75, 0);
    expect(need('B')).toBeCloseTo(79.25, 0);
    expect(need('D')).toBeCloseTo(21.75, 0);
    // Each threshold, fed back into the projection, lands on its letter.
    expect(projectCourseGrade(graded, 40, 80)).toBeGreaterThanOrEqual(83);
  });

  it('has no thresholds when nothing is left to score', () => {
    expect(remainingScoreThresholds(graded, 0)).toEqual([]);
  });
});

describe('remainingWorkFromScheduleItems', () => {
  it('sums the weight of ungraded items, soonest first', () => {
    const result = remainingWorkFromScheduleItems([
      item({ id: 'h', gradeWeight: 30, earnedScore: 90 }),
      item({ id: 'f', title: 'Final Exam', gradeWeight: 40, dueDate: '2026-12-10' }),
      item({ id: 'p', title: 'Project 2', gradeWeight: 15, dueDate: '2026-11-01' }),
      item({ id: 'n', title: 'Ungraded reading' }),
    ]);
    expect(result).toEqual({ weight: 55, titles: ['Project 2', 'Final Exam'] });
  });

  it('falls back to what the graded weight leaves of 100 when nothing ungraded is on record', () => {
    expect(
      remainingWorkFromScheduleItems([
        item({ id: 'a', gradeWeight: 40, earnedScore: 88 }),
        item({ id: 'b', gradeWeight: 30, earnedScore: 92 }),
      ]),
    ).toEqual({ weight: 30, titles: [] });
    expect(
      remainingWorkFromScheduleItems([item({ id: 'a', gradeWeight: 100, earnedScore: 80 })]),
    ).toEqual({ weight: 0, titles: [] });
  });
});

describe('courseStanding', () => {
  const item = (o: Partial<ScheduleItem> & { id: string }): ScheduleItem => ({
    courseId: 'cs',
    title: o.id,
    type: 'assignment',
    dueDate: '2026-09-01',
    completed: true,
    ...o,
  });

  it('is null until something is graded, never an optimistic 100% A', () => {
    expect(courseStanding([])).toBeNull();
    expect(courseStanding([item({ id: 'a', gradeWeight: 20 })])).toBeNull();
    expect(courseStanding([item({ id: 'b', earnedScore: 90 })])).toBeNull();
  });

  it('averages graded work by weight and says how much of the grade it covers', () => {
    const s = courseStanding([
      item({ id: 'hw', gradeWeight: 10, earnedScore: 92, gradeCategory: 'Homework' }),
      item({ id: 'mid', gradeWeight: 25, earnedScore: 78, gradeCategory: 'Exams' }),
      item({ id: 'final', gradeWeight: 40, gradeCategory: 'Exams' }),
    ]);
    // (10*92 + 25*78) / 35 = 82
    expect(s).toEqual({ percentage: 82, letter: 'B-', decidedWeight: 35, gradedCount: 2 });
  });
});
