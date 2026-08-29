import { describe, it, expect } from 'vitest';
import {
  scoreToLetterGrade,
  calculateTermGpa,
  computeGpaGoalTarget,
  CourseGradeEntry,
} from '../gpaMath';

describe('GPA Math Calculation Engine (Item 47)', () => {
  it('converts numerical scores to correct letter grade', () => {
    expect(scoreToLetterGrade(98)).toBe('A+');
    expect(scoreToLetterGrade(94)).toBe('A');
    expect(scoreToLetterGrade(91)).toBe('A-');
    expect(scoreToLetterGrade(85)).toBe('B');
    expect(scoreToLetterGrade(78)).toBe('C+');
    expect(scoreToLetterGrade(50)).toBe('F');
  });

  it('calculates term GPA and quality points correctly', () => {
    const sampleCourses: CourseGradeEntry[] = [
      { courseId: '1', courseCode: 'CS 101', title: 'Intro CS', credits: 4, grade: 'A' }, // 4 * 4.0 = 16
      { courseId: '2', courseCode: 'MATH 101', title: 'Calculus', credits: 4, grade: 'B' }, // 4 * 3.0 = 12
    ];

    const result = calculateTermGpa(sampleCourses);
    expect(result.totalCredits).toBe(8);
    expect(result.qualityPoints).toBe(28);
    expect(result.termGpa).toBe(3.5);
  });

  it('computes needed term GPA to achieve cumulative goal', () => {
    const currentCourses: CourseGradeEntry[] = [
      { courseId: '1', courseCode: 'CS 101', title: 'Intro CS', credits: 4, grade: 'A' },
      { courseId: '2', courseCode: 'MATH 101', title: 'Calculus', credits: 4, grade: 'A' },
      { courseId: '3', courseCode: 'PHYS 101', title: 'Physics', credits: 4, grade: 'A' },
      { courseId: '4', courseCode: 'ENGL 101', title: 'English', credits: 4, grade: 'A' },
    ]; // 16 credits of 4.0 = term GPA 4.0

    // Prior 30 credits @ 3.0 GPA (90 pts)
    // Term 16 credits @ 4.0 GPA (64 pts)
    // New Cumulative: (90 + 64) / 46 = 154 / 46 = 3.3478 -> 3.35
    const goal = computeGpaGoalTarget({
      priorCumulativeGpa: 3.0,
      priorEarnedCredits: 30,
      currentCourses,
      targetCumulativeGpa: 3.34,
    });

    expect(goal.currentTermGpa).toBe(4.0);
    expect(goal.totalTermCredits).toBe(16);
    expect(goal.status).toBe('ahead');
  });

  it('flags mathematically unreachable term GPA goals', () => {
    const currentCourses: CourseGradeEntry[] = [
      { courseId: '1', courseCode: 'CS 101', title: 'Intro CS', credits: 3, grade: 'A' },
    ];

    // Prior 90 credits @ 2.50 GPA, trying to reach 3.90 in one 3-credit semester
    const goal = computeGpaGoalTarget({
      priorCumulativeGpa: 2.50,
      priorEarnedCredits: 90,
      currentCourses,
      targetCumulativeGpa: 3.90,
    });

    expect(goal.status).toBe('unreachable');
    expect(goal.targetTermGpaNeeded).toBeGreaterThan(4.0);
    expect(goal.advice).toContain('out of reach');
  });
});
