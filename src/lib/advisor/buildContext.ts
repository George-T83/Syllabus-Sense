import {
  computeOverallProgress,
  computeCategoryProgress,
  groupCoursesByTerm,
} from '@/lib/degreeCompass/progress';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';
import type { Course } from '@/types/schedule';

export interface AdvisorReasoningSummary {
  degreeConnected: boolean;
  completedTerms: number;
  creditsCompleted: number;
  creditsInProgress: number;
  creditsRequired: number;
}

/** A trimmed, client-sent summary of a Course - `title`/`term` stay
 * optional here even though they're required on the real `Course` type,
 * since the request body this is built from is untyped JSON off the wire. */
export interface AdvisorCourseSummary extends Pick<Course, 'code'> {
  title?: string;
  term?: string;
}

export interface AdvisorContextInput {
  degreeProfile: DegreeProfile | null;
  degreeCourses: DegreeCourse[];
  courses: AdvisorCourseSummary[];
  pendingTaskCount: number;
  overdueTaskCount: number;
}

function countCompletedTerms(degreeCourses: DegreeCourse[]): number {
  return new Set(degreeCourses.filter((c) => c.status === 'completed').map((c) => c.term)).size;
}

/** Small, display-ready numbers for the "Reasoning over" panel - kept
 * separate from the prose context block below so the UI never has to parse
 * the model's own text back out to render a stat. */
export function summarizeAdvisorContext(input: AdvisorContextInput): AdvisorReasoningSummary {
  if (!input.degreeProfile) {
    return {
      degreeConnected: false,
      completedTerms: 0,
      creditsCompleted: 0,
      creditsInProgress: 0,
      creditsRequired: 0,
    };
  }
  const overall = computeOverallProgress(input.degreeProfile.categories, input.degreeCourses);
  return {
    degreeConnected: true,
    completedTerms: countCompletedTerms(input.degreeCourses),
    creditsCompleted: overall.creditsCompleted,
    creditsInProgress: overall.creditsInProgress,
    creditsRequired: overall.creditsRequired,
  };
}

function currentTermBlock(input: AdvisorContextInput): string {
  const courseLines = input.courses.length
    ? input.courses
        .map((c) => `- ${c.code}${c.title ? ` — ${c.title}` : ''} (${c.term ?? 'no term set'})`)
        .join('\n')
    : '- none on file';
  return [
    'Current syllabus-tracked courses (from Courses, separate from the Degree Compass ledger below):',
    courseLines,
    `Tasks: ${input.pendingTaskCount} pending, ${input.overdueTaskCount} overdue.`,
  ].join('\n');
}

/**
 * Renders the student's real data as a plain-text block for the Advisor's
 * system prompt. The model reasons only over what's written here, never
 * over a raw Firestore dump - every fact it can cite is one this function
 * chose to include, and everything it can't see (an official transcript,
 * a registrar's prerequisite chains, add/drop deadlines) is named as out of
 * scope so the model doesn't imply it has access it doesn't.
 */
export function buildAdvisorContextBlock(input: AdvisorContextInput): string {
  const { degreeProfile, degreeCourses } = input;

  if (!degreeProfile) {
    return [
      "Degree Compass: not set up yet. The student has no saved degree plan - don't invent credit totals, categories, or a graduation timeline. If asked a whole-degree question, say Degree Compass needs to be set up first, then answer whatever you can from the current-term data below.",
      currentTermBlock(input),
    ].join('\n\n');
  }

  const overall = computeOverallProgress(degreeProfile.categories, degreeCourses);
  const categoryProgress = computeCategoryProgress(degreeProfile.categories, degreeCourses);
  const termGroups = groupCoursesByTerm(degreeCourses);

  const categoryLines = categoryProgress
    .map((c) => {
      const earned = c.creditsCompleted + c.creditsInProgress;
      return `- ${c.category.name}: ${earned}/${c.category.creditsRequired} credits (${c.creditsRemaining} remaining)`;
    })
    .join('\n');

  const termLines = termGroups.length
    ? termGroups
        .map((g) => `- ${g.term}: ${g.courses.length} course(s), ${g.totalCredits} credits`)
        .join('\n')
    : '- none on file';

  return [
    `Degree Compass plan: ${degreeProfile.majorName}${degreeProfile.minorName ? ` (minor: ${degreeProfile.minorName})` : ''}.`,
    `Overall: ${overall.creditsCompleted} completed + ${overall.creditsInProgress} in-progress credits, out of ${overall.creditsRequired} required.`,
    `Completed terms: ${countCompletedTerms(degreeCourses)}.`,
    'Requirement categories:\n' + categoryLines,
    'Terms in the saved plan:\n' + termLines,
    currentTermBlock(input),
    "This is the student's own saved plan, not their official transcript - you can be wrong about prerequisite chains, add/drop deadlines, or what actually counts toward graduation. Say so whenever a question depends on those.",
  ].join('\n\n');
}
