import type { AssignmentType, Priority } from '@/types/schedule';

/**
 * #49 Workload formula matrix.
 *
 * Intrinsic "weight" per assignment type: a multiplier applied to raw estimated
 * hours to reflect that not all hours are equally taxing on working memory.
 * An exam hour is more cognitively demanding (recall under pressure, higher stakes,
 * broader synthesis of material) than a reading hour (largely linear consumption).
 * These are deliberately kept as simple multipliers (not additive constants) so a
 * 10-hour exam and a 2-hour exam scale consistently relative to each other.
 *
 * Tunable: adjust values here only; nothing downstream should special-case a type.
 */
export const ASSIGNMENT_TYPE_WEIGHT: Record<AssignmentType, number> = {
  exam: 1.5,
  project: 1.35,
  quiz: 1.15,
  assignment: 1.0,
  reading: 0.7,
  other: 1.0,
};

/**
 * Fallback estimated hours used when `ScheduleItem.estimatedHours` is omitted.
 * Values are rough, conservative defaults derived from typical college workloads
 * (~1-3 hrs/week per credit hour, split across item types). They exist purely so
 * the engine never silently treats an unestimated item as zero load.
 */
export const DEFAULT_ESTIMATED_HOURS: Record<AssignmentType, number> = {
  exam: 6,
  project: 8,
  quiz: 1.5,
  assignment: 3,
  reading: 1.5,
  other: 2,
};

/**
 * #52 Stress-factor coefficients derived from onboarding poll responses.
 *
 * The poll asks the student to self-report a general stress/anxiety disposition
 * and a priority for a given item. Both are expressed as multipliers so they can
 * be composed (multiplied) with the base weighted-hours load without changing its
 * units. A value of 1.0 means "no adjustment".
 */

/**
 * Self-reported baseline stress disposition from the onboarding poll.
 * Students who report higher baseline stress perceive the same objective
 * workload as heavier, so their effective load is scaled up.
 */
export type StressDisposition = 'low' | 'moderate' | 'high';

export const STRESS_DISPOSITION_COEFFICIENT: Record<StressDisposition, number> = {
  low: 0.9,
  moderate: 1.0,
  high: 1.2,
};

/**
 * Priority-based multiplier: a student-flagged high-priority item tends to
 * occupy more mental bandwidth (rumination, anticipatory anxiety) than its raw
 * hour count alone would suggest, independent of the assignment type weight.
 */
export const PRIORITY_STRESS_COEFFICIENT: Record<Priority, number> = {
  low: 0.95,
  medium: 1.0,
  high: 1.1,
};

/**
 * #54 Visual indicator thresholds (Low/Medium/High/Extreme -> WorkloadLevel).
 *
 * Thresholds are expressed in "effective cognitive-load hours" for a single day
 * (i.e. after type weighting and stress coefficients have already been applied).
 * Boundaries were chosen against a typical student's available daily focus
 * budget: ~2-3 productive hours is comfortable, 3-5 is a full but manageable
 * day, 5-8 starts crowding out rest/other classes, and 8+ is unsustainable.
 * `critical` is the naming used by WorkloadLevel; we surface it to callers as
 * "Extreme" only as a display label, not as a separate type.
 */
export const WORKLOAD_LEVEL_THRESHOLDS = {
  low: 3,
  medium: 5,
  high: 8,
  // Anything at/above `high` is `critical`.
} as const;

/** Human-readable labels for each WorkloadLevel, for display purposes only. */
export const WORKLOAD_LEVEL_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Extreme',
} as const;
