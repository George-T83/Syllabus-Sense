import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { Source } from '@/types/source';
import type { Flashcard } from '@/types/flashcard';
import type { Quiz, QuizAttempt } from '@/types/quiz';
import type { MoodEntry } from '@/types/mood';
import type { GradeScenario } from '@/types/gradeScenario';
import type { SyllabusUpload } from '@/types/syllabus';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';
import type { AdvisorMessage } from '@/types/advisor';
import type { PomodoroSession } from '@/lib/focus/pomodoroSessions';

/**
 * Bump when a section is added, removed or reshaped, so a file saved today
 * can still be read by whatever reads it later.
 *   1 - courses, scheduleItems, contacts, moodEntries, gradeScenarios,
 *       preferences, syllabi (no version field)
 *   2 - adds sources, flashcards, quizzes, quizAttempts, degreeProfile,
 *       degreeCourses, advisorMessages, focusSessions, and this field
 */
export const EXPORT_SCHEMA_VERSION = 2;

export interface DataExportInput {
  account: { email: string | null; displayName: string | null; memberSince: string | null };
  courses: Course[];
  scheduleItems: ScheduleItem[];
  contacts: Contact[];
  sources: Source[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  moodEntries: MoodEntry[];
  gradeScenarios: GradeScenario[];
  syllabi: SyllabusUpload[];
  degreeProfile: DegreeProfile | null;
  degreeCourses: DegreeCourse[];
  advisorMessages: AdvisorMessage[];
  focusSessions: PomodoroSession[];
  preferences: unknown;
}

/** Every collection the app stores for a user, with a count for each so a
 * reader can see at a glance that nothing was left out. */
export function buildDataExport(input: DataExportInput, now: Date = new Date()) {
  const { account, preferences, degreeProfile, ...collections } = input;
  const counts: Record<string, number> = Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [name, rows.length]),
  );
  counts.degreeProfile = degreeProfile ? 1 : 0;
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    account,
    counts,
    ...collections,
    degreeProfile,
    preferences,
    notIncluded: [
      'The uploaded syllabus files themselves (each is listed under "syllabi" with its file name).',
      'Daily AI usage counters.',
    ],
  };
}
