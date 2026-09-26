/**
 * Academic Grade Math & Target GPA Simulator
 *
 * Implements rigorous grade weight distribution, weighted average scoring,
 * final exam target score solving, and cumulative semester GPA modeling.
 */

import type { ScheduleItem } from '@/types/schedule';

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

/**
 * Turns a course's real, graded schedule items into `GradeCategory` rows -
 * the actual standing to seed the what-if calculator with, instead of a
 * fictional starting point the student has to re-enter by hand every time.
 * An item only counts once it has both a weight and a received score;
 * grading category defaults to "Other" for an item with a weight but no
 * category name on record, rather than silently dropping its weight from
 * the total. Multiple items in the same category are combined into one row
 * (weight summed, score weighted by each item's own weight).
 */
export function deriveCategoriesFromScheduleItems(items: ScheduleItem[]): GradeCategory[] {
  const graded = items.filter(
    (item) => typeof item.gradeWeight === 'number' && typeof item.earnedScore === 'number',
  );

  const byCategory = new Map<string, { weight: number; weightedScore: number }>();
  for (const item of graded) {
    const name = item.gradeCategory?.trim() || 'Other';
    const weight = item.gradeWeight ?? 0;
    const score = item.earnedScore ?? 0;
    const existing = byCategory.get(name) ?? { weight: 0, weightedScore: 0 };
    byCategory.set(name, {
      weight: existing.weight + weight,
      weightedScore: existing.weightedScore + weight * score,
    });
  }

  return Array.from(byCategory.entries()).map(([name, { weight, weightedScore }]) => ({
    id: `real-${name}`,
    name,
    weight: Math.round(weight * 100) / 100,
    score: weight > 0 ? Math.round((weightedScore / weight) * 100) / 100 : 0,
  }));
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
  targetPercentage: number,
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
  const rawRequiredFinalScore = pointsNeededFromFinal / (finalWeight / 100);
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

export interface GradeFloorCeilingResult {
  floorPercentage: number;
  floorLetterGrade: string;
  ceilingPercentage: number;
  ceilingLetterGrade: string;
  /** True once the final is the only thing left (floor === ceiling) - there's
   * no remaining uncertainty to show a range for. */
  isLocked: boolean;
}

/**
 * The mathematically guaranteed minimum and maximum final grade, given the
 * categories already entered (this app's model treats whatever's in
 * `categories` as the student's current, locked-in standing - the same
 * assumption `calculateCurrentWeightedGrade` and `calculateRequiredFinalScore`
 * already make) and one remaining unknown: the final exam. Floor assumes a 0%
 * final; ceiling assumes a 100% final. Companion to the "required final
 * score" solver above - that answers "what do I need," this answers "what's
 * the actual range no matter what."
 */
export function calculateGradeFloorCeiling(
  categories: GradeCategory[],
  finalExamWeight: number,
): GradeFloorCeilingResult {
  const finalWeight = Math.max(0, finalExamWeight);

  let nonFinalPoints = 0;
  let nonFinalTotalWeight = 0;
  for (const cat of categories) {
    const weight = Math.max(0, cat.weight || 0);
    const score = Math.max(0, cat.score || 0);
    const max = cat.maxScore && cat.maxScore > 0 ? cat.maxScore : 100;
    const normScore = (score / max) * 100;

    nonFinalPoints += (normScore * weight) / 100;
    nonFinalTotalWeight += weight;
  }

  const totalCourseWeight = nonFinalTotalWeight + finalWeight;
  if (totalCourseWeight <= 0) {
    return {
      floorPercentage: 0,
      floorLetterGrade: 'F',
      ceilingPercentage: 0,
      ceilingLetterGrade: 'F',
      isLocked: true,
    };
  }

  const floorPercentage = Math.round((nonFinalPoints / totalCourseWeight) * 100 * 100) / 100;
  const ceilingPercentage =
    Math.round(((nonFinalPoints + finalWeight) / totalCourseWeight) * 100 * 100) / 100;

  return {
    floorPercentage,
    floorLetterGrade: percentageToLetterGrade(floorPercentage),
    ceilingPercentage,
    ceilingLetterGrade: percentageToLetterGrade(ceilingPercentage),
    isLocked: finalWeight === 0,
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
  courses: { credits?: number; gpaPoints?: number; percentage?: number }[],
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

function lockedInTotals(categories: GradeCategory[]): { points: number; weight: number } {
  let points = 0;
  let weight = 0;
  for (const cat of categories) {
    const w = Math.max(0, cat.weight || 0);
    const score = Math.max(0, cat.score || 0);
    const max = cat.maxScore && cat.maxScore > 0 ? cat.maxScore : 100;
    points += ((score / max) * 100 * w) / 100;
    weight += w;
  }
  return { points, weight };
}

export interface RemainingWork {
  /** Share of the course grade still ahead, in percent. */
  weight: number;
  /** Titles of the ungraded items that make it up, soonest first - empty
   * when the weight is inferred from what the graded work leaves of 100. */
  titles: string[];
}

/**
 * How much of the grade is still ahead, from the course's own schedule:
 * every item with a grade weight but no score yet. When nothing ungraded is
 * on record, it falls back to whatever the graded weight leaves of 100% -
 * the old hard-coded 30% silently disagreed with any syllabus whose final
 * wasn't worth exactly 30.
 */
export function remainingWorkFromScheduleItems(items: ScheduleItem[]): RemainingWork {
  const ungraded = items
    .filter(
      (i) =>
        typeof i.gradeWeight === 'number' && i.gradeWeight > 0 && typeof i.earnedScore !== 'number',
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const ungradedWeight = ungraded.reduce((sum, i) => sum + (i.gradeWeight ?? 0), 0);
  if (ungradedWeight > 0) {
    return { weight: Math.round(ungradedWeight * 100) / 100, titles: ungraded.map((i) => i.title) };
  }
  const gradedWeight = items
    .filter((i) => typeof i.gradeWeight === 'number' && typeof i.earnedScore === 'number')
    .reduce((sum, i) => sum + (i.gradeWeight ?? 0), 0);
  return { weight: Math.max(0, Math.round((100 - gradedWeight) * 100) / 100), titles: [] };
}

/**
 * The course grade you finish with if you average `remainingScore` percent
 * on everything still ahead (`remainingWeight` percent of the grade) - the
 * number the what-if slider moves.
 */
export function projectCourseGrade(
  categories: GradeCategory[],
  remainingWeight: number,
  remainingScore: number,
): number {
  const { points, weight } = lockedInTotals(categories);
  const rw = Math.max(0, remainingWeight);
  const total = weight + rw;
  if (total <= 0) return 0;
  const score = Math.max(0, remainingScore);
  return Math.round(((points + (rw * score) / 100) / total) * 100 * 100) / 100;
}

export interface LetterScoreThreshold {
  letter: string;
  minPercentage: number;
  /** Average needed on the remaining work to finish at or above this
   * letter. Can be below 0 (already locked in) or above 100 (out of reach). */
  scoreNeeded: number;
}

/**
 * For every passing letter, the score needed on what's left to reach it -
 * the breakpoints the slider's track is colored by. Empty when nothing is
 * left to score.
 */
export function remainingScoreThresholds(
  categories: GradeCategory[],
  remainingWeight: number,
): LetterScoreThreshold[] {
  const rw = Math.max(0, remainingWeight);
  if (rw <= 0) return [];
  const { points, weight } = lockedInTotals(categories);
  const total = weight + rw;
  return STANDARD_GRADE_SCALE.filter((t) => t.minPercentage > 0).map((t) => ({
    letter: t.letter,
    minPercentage: t.minPercentage,
    scoreNeeded: Math.round((((t.minPercentage * total) / 100 - points) / (rw / 100)) * 10) / 10,
  }));
}

export interface CourseStanding {
  /** Running grade over the work graded so far. */
  percentage: number;
  letter: string;
  /** Share of the final grade already decided by graded work, in percent. */
  decidedWeight: number;
  /** How many graded items it rests on. */
  gradedCount: number;
}

/**
 * Where a student stands in a course right now, from their own graded work:
 * the weighted average of every item with both a weight and a score. Null
 * when nothing is graded yet - calculateCurrentWeightedGrade reports an
 * optimistic 100% A for an empty course, which is no standing at all.
 */
export function courseStanding(items: ScheduleItem[]): CourseStanding | null {
  const graded = items.filter(
    (i) =>
      typeof i.gradeWeight === 'number' && i.gradeWeight > 0 && typeof i.earnedScore === 'number',
  );
  if (graded.length === 0) return null;
  const { currentPercentage, letterGrade, totalCompletedWeight } = calculateCurrentWeightedGrade(
    deriveCategoriesFromScheduleItems(graded),
  );
  if (totalCompletedWeight <= 0) return null;
  return {
    percentage: Math.round(currentPercentage * 10) / 10,
    letter: letterGrade,
    decidedWeight: Math.round(totalCompletedWeight * 10) / 10,
    gradedCount: graded.length,
  };
}

export interface SemesterGpaSummary {
  /** Credit-weighted GPA across every course that has at least one graded item. */
  gpa: number;
  /** How many courses that GPA is built from. */
  gradedCourseCount: number;
  /** How many courses were considered, graded or not - so a caller can say
   * "2 of 5 courses" instead of implying the GPA covers the whole term. */
  totalCourseCount: number;
  totalCredits: number;
}

/**
 * Rolls every course's real current standing into one credit-weighted
 * semester GPA. A course with nothing graded yet is left out rather than
 * assumed - the same honesty `courseStanding` already holds to - so this
 * returns null (not an optimistic 4.0) until at least one course has a
 * graded item.
 */
export function summarizeSemesterGpa(
  courses: { id: string; credits?: number }[],
  itemsByCourseId: Map<string, ScheduleItem[]>,
): SemesterGpaSummary | null {
  const graded = courses
    .map((course) => {
      const standing = courseStanding(itemsByCourseId.get(course.id) ?? []);
      if (!standing) return null;
      return { credits: course.credits ?? 3, percentage: standing.percentage };
    })
    .filter((c): c is { credits: number; percentage: number } => c !== null);

  if (graded.length === 0) return null;

  const { gpa, totalCredits } = calculateSemesterGpa(graded);
  return {
    gpa,
    gradedCourseCount: graded.length,
    totalCourseCount: courses.length,
    totalCredits,
  };
}
