/**
 * Academic Grade Math & Target GPA Simulator
 *
 * Implements rigorous grade weight distribution, weighted average scoring,
 * final exam target score solving, and cumulative semester GPA modeling.
 */

export interface GradeCategory {
  id?: string;
  name: string;
  weight: number; // percentage, e.g. 20 for 20%
  score: number; // current score percentage, e.g. 88 for 88%
  maxScore?: number; // default 100
  isFinalExam?: boolean;
}

export interface StandardGradeThreshold {
  letter: string;
  minPercentage: number;
  gpaPoints: number;
}

export const STANDARD_GRADE_SCALE: readonly StandardGradeThreshold[] = [
  { letter: 'A', minPercentage: 93.0, gpaPoints: 4.0 },
  { letter: 'A-', minPercentage: 90.0, gpaPoints: 3.7 },
  { letter: 'B+', minPercentage: 87.0, gpaPoints: 3.3 },
  { letter: 'B', minPercentage: 83.0, gpaPoints: 3.0 },
  { letter: 'B-', minPercentage: 80.0, gpaPoints: 2.7 },
  { letter: 'C+', minPercentage: 77.0, gpaPoints: 2.3 },
  { letter: 'C', minPercentage: 73.0, gpaPoints: 2.0 },
  { letter: 'C-', minPercentage: 70.0, gpaPoints: 1.7 },
  { letter: 'D+', minPercentage: 67.0, gpaPoints: 1.3 },
  { letter: 'D', minPercentage: 60.0, gpaPoints: 1.0 },
  { letter: 'F', minPercentage: 0.0, gpaPoints: 0.0 },
] as const;

/**
 * Converts a numerical percentage (0-100+) into a letter grade based on standard grading scale.
 */
export function percentageToLetterGrade(percentage: number): string {
  if (isNaN(percentage) || percentage < 0) return 'F';
  for (const threshold of STANDARD_GRADE_SCALE) {
    if (percentage >= threshold.minPercentage) {
      return threshold.letter;
    }
  }
  return 'F';
}

/**
 * Converts a letter grade to standard 4.0 scale quality points.
 */
export function letterGradeToGpaPoints(letterGrade: string): number {
  const normalized = letterGrade.trim().toUpperCase();
  const found = STANDARD_GRADE_SCALE.find((t) => t.letter.toUpperCase() === normalized);
  return found ? found.gpaPoints : 0.0;
}

/**
 * Calculates current weighted percentage across completed categories.
 */
export function calculateCurrentWeightedGrade(categories: GradeCategory[]): {
  currentPercentage: number;
  letterGrade: string;
  gpaPoints: number;
  totalCompletedWeight: number;
} {
  if (!categories || categories.length === 0) {
    return { currentPercentage: 100, letterGrade: 'A', gpaPoints: 4.0, totalCompletedWeight: 0 };
  }

  let totalWeightedPoints = 0;
  let totalWeight = 0;

  for (const cat of categories) {
    const weight = Math.max(0, cat.weight || 0);
    const score = Math.max(0, cat.score || 0);
    const max = cat.maxScore && cat.maxScore > 0 ? cat.maxScore : 100;
    const normalizedScore = (score / max) * 100;

    totalWeightedPoints += (normalizedScore * weight) / 100;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return { currentPercentage: 100, letterGrade: 'A', gpaPoints: 4.0, totalCompletedWeight: 0 };
  }

  // Percentage normalized to the weight completed so far
  const normalizedPercentage = Math.round(((totalWeightedPoints * 100) / totalWeight) * 100) / 100;
  const letterGrade = percentageToLetterGrade(normalizedPercentage);
  const gpaPoints = letterGradeToGpaPoints(letterGrade);

  return {
    currentPercentage: normalizedPercentage,
    letterGrade,
    gpaPoints,
    totalCompletedWeight: totalWeight,
  };
}

export type TargetScoreStatus = 'already_achieved' | 'achievable' | 'challenging' | 'impossible';

export interface FinalExamTargetResult {
  targetGrade: string;
  targetPercentage: number;
  requiredFinalScore: number;
  isAchievable: boolean;
  isGuaranteed: boolean;
  status: TargetScoreStatus;
  statusMessage: string;
}

/**
 * Calculates the exact score required on a remaining assessment / final exam
 * to achieve a specific target percentage overall.
 *
 * Formula:
 * Total Target = Non-final weighted sum + (Final Weight * Required Score / 100)
 * Required Score = [Target % - (Non-final weighted points)] / (Final Weight / 100)
 */
export function calculateRequiredFinalScore(
  nonFinalCategories: GradeCategory[],
  finalExamWeight: number,
  targetPercentage: number
): FinalExamTargetResult {
  const targetGrade = percentageToLetterGrade(targetPercentage);
  const finalWeight = Math.max(0.1, finalExamWeight);

  let nonFinalPoints = 0;
  let nonFinalTotalWeight = 0;

  for (const cat of nonFinalCategories) {
    const weight = Math.max(0, cat.weight || 0);
    const score = Math.max(0, cat.score || 0);
    const max = cat.maxScore && cat.maxScore > 0 ? cat.maxScore : 100;
    const normScore = (score / max) * 100;

    nonFinalPoints += (normScore * weight) / 100;
    nonFinalTotalWeight += weight;
  }

  // Total weight of the course (e.g. 100%)
  const totalCourseWeight = nonFinalTotalWeight + finalWeight;
  const targetTotalPoints = (targetPercentage * totalCourseWeight) / 100;

  const pointsNeededFromFinal = targetTotalPoints - nonFinalPoints;
  const rawRequiredFinalScore = (pointsNeededFromFinal / (finalWeight / 100));
  const roundedRequired = Math.round(rawRequiredFinalScore * 10) / 10;

  let status: TargetScoreStatus = 'achievable';
  let statusMessage = `You need a ${roundedRequired}% on the Final Exam to earn a ${targetGrade} (${targetPercentage}%).`;
  let isAchievable = true;
  let isGuaranteed = false;

  if (roundedRequired <= 0) {
    status = 'already_achieved';
    isGuaranteed = true;
    statusMessage = `You have already secured a ${targetGrade} (${targetPercentage}%) regardless of the Final Exam!`;
  } else if (roundedRequired > 100) {
    status = 'impossible';
    isAchievable = false;
    statusMessage = `Mathematically impossible to achieve ${targetGrade} (${targetPercentage}%): requires ${roundedRequired}% on the Final Exam.`;
  } else if (roundedRequired >= 90) {
    status = 'challenging';
    statusMessage = `Challenging goal: You need a high ${roundedRequired}% on the Final Exam to secure a ${targetGrade}.`;
  }

  return {
    targetGrade,
    targetPercentage,
    requiredFinalScore: roundedRequired,
    isAchievable,
    isGuaranteed,
    status,
    statusMessage,
  };
}

export interface SemesterCourseProjection {
  id: string;
  code: string;
  credits: number;
  currentPercentage: number;
  projectedPercentage?: number;
  letterGrade: string;
  gpaPoints: number;
}

/**
 * Calculates term GPA weighted by credit hours.
 */
export function calculateSemesterGpa(
  courses: { credits?: number; gpaPoints?: number; percentage?: number }[]
): {
  gpa: number;
  totalCredits: number;
  qualityPoints: number;
} {
  let totalQualityPoints = 0;
  let totalCredits = 0;

  for (const course of courses) {
    const credits = course.credits ?? 3;
    if (credits <= 0) continue; // 0-credit defense

    let points = course.gpaPoints;
    if (points === undefined && course.percentage !== undefined) {
      const letter = percentageToLetterGrade(course.percentage);
      points = letterGradeToGpaPoints(letter);
    }
    const safePoints = points ?? 0.0;

    totalQualityPoints += safePoints * credits;
    totalCredits += credits;
  }

  if (totalCredits <= 0) {
    return { gpa: 4.0, totalCredits: 0, qualityPoints: 0 };
  }

  const gpa = Math.round((totalQualityPoints / totalCredits) * 100) / 100;
  return {
    gpa,
    totalCredits,
    qualityPoints: Math.round(totalQualityPoints * 100) / 100,
  };
}
