export type LetterGrade =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D+'
  | 'D'
  | 'F';

export const GRADE_POINT_MAP: Record<LetterGrade, number> = {
  'A+': 4.0,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  F: 0.0,
};

export interface CourseGradeEntry {
  courseId: string;
  courseCode: string;
  title: string;
  credits: number;
  grade: LetterGrade;
}

export interface GpaGoalResult {
  currentTermGpa: number;
  totalTermCredits: number;
  totalTermQualityPoints: number;
  projectedCumulativeGpa: number;
  targetTermGpaNeeded: number | null;
  status: 'ahead' | 'on_track' | 'at_risk' | 'unreachable';
  progressPercentage: number;
  advice: string;
}

/**
 * Converts a numerical percentage score (0-100) into standard letter grade.
 */
export function scoreToLetterGrade(score: number): LetterGrade {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Calculates semester GPA from an array of course grade entries.
 */
export function calculateTermGpa(courses: CourseGradeEntry[]): {
  termGpa: number;
  totalCredits: number;
  qualityPoints: number;
} {
  if (!courses || courses.length === 0) {
    return { termGpa: 0, totalCredits: 0, qualityPoints: 0 };
  }

  let totalQualityPoints = 0;
  let totalCredits = 0;

  courses.forEach((c) => {
    const credits = Math.max(0, c.credits || 0);
    if (credits > 0) {
      const points = GRADE_POINT_MAP[c.grade] ?? 0;
      totalQualityPoints += points * credits;
      totalCredits += credits;
    }
  });

  const termGpa = totalCredits > 0 ? Number((totalQualityPoints / totalCredits).toFixed(2)) : 0;
  return {
    termGpa,
    totalCredits,
    qualityPoints: Number(totalQualityPoints.toFixed(2)),
  };
}

/**
 * Calculates the required term GPA to achieve a cumulative GPA target.
 */
export function computeGpaGoalTarget({
  priorCumulativeGpa,
  priorEarnedCredits,
  currentCourses,
  targetCumulativeGpa,
}: {
  priorCumulativeGpa: number;
  priorEarnedCredits: number;
  currentCourses: CourseGradeEntry[];
  targetCumulativeGpa: number;
}): GpaGoalResult {
  const { termGpa, totalCredits: termCredits, qualityPoints: termQualityPoints } =
    calculateTermGpa(currentCourses);

  const priorPoints = priorCumulativeGpa * priorEarnedCredits;
  const newTotalCredits = priorEarnedCredits + termCredits;
  const newTotalPoints = priorPoints + termQualityPoints;

  const projectedCumulativeGpa =
    newTotalCredits > 0 ? Number((newTotalPoints / newTotalCredits).toFixed(2)) : termGpa;

  let targetTermGpaNeeded: number | null = null;
  let status: 'ahead' | 'on_track' | 'at_risk' | 'unreachable' = 'on_track';
  let advice = '';

  if (termCredits > 0) {
    const neededTotalPoints = targetCumulativeGpa * newTotalCredits;
    const neededTermPoints = neededTotalPoints - priorPoints;
    const rawNeeded = neededTermPoints / termCredits;
    targetTermGpaNeeded = Number(Math.max(0, rawNeeded).toFixed(2));

    // Handle floating point precision near 4.0
    if (targetTermGpaNeeded > 4.01) {
      status = 'unreachable';
      advice = `A ${targetCumulativeGpa.toFixed(2)} cumulative GPA is mathematically out of reach this term alone (requires ${targetTermGpaNeeded.toFixed(2)} GPA across ${termCredits} credits). Consider adjusting to a multi-semester ramp.`;
    } else if (termGpa >= targetTermGpaNeeded || (targetTermGpaNeeded <= 4.0 && termGpa >= 3.99)) {
      status = 'ahead';
      advice = `Outstanding! Your current projected term GPA of ${termGpa.toFixed(2)} meets or exceeds the required ${targetTermGpaNeeded.toFixed(2)} to achieve your ${targetCumulativeGpa.toFixed(2)} cumulative target.`;
    } else if (targetTermGpaNeeded - termGpa <= 0.35) {
      status = 'on_track';
      advice = `You are within striking distance. A target term GPA of ${targetTermGpaNeeded.toFixed(2)} is needed across your ${termCredits} credits to achieve a ${targetCumulativeGpa.toFixed(2)} cumulative GPA.`;
    } else {
      status = 'at_risk';
      advice = `At risk: You currently project a ${termGpa.toFixed(2)} term GPA, but need a ${targetTermGpaNeeded.toFixed(2)} to reach your cumulative goal. Focus on high-credit courses.`;
    }
  } else {
    status = 'on_track';
    advice = 'Add enrolled courses and credit weights to calculate required semester GPA.';
  }

  // Progress percentage toward 4.0 max
  const progressPercentage = Math.min(100, Math.max(0, Math.round((projectedCumulativeGpa / 4.0) * 100)));

  return {
    currentTermGpa: termGpa,
    totalTermCredits: termCredits,
    totalTermQualityPoints: termQualityPoints,
    projectedCumulativeGpa,
    targetTermGpaNeeded,
    status,
    progressPercentage,
    advice,
  };
}
