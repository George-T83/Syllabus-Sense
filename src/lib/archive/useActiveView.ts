'use client';

import { useMemo } from 'react';
import type { AppState } from '@/context/AppStateContext';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { Source } from '@/types/source';
import type { Flashcard } from '@/types/flashcard';
import type { Quiz, QuizAttempt } from '@/types/quiz';
import {
  archivedCourseIds,
  isArchived,
  onlyArchivedRecords,
  withoutArchivedRecords,
} from '@/lib/archive/archive';

/** What the student has archived: the courses, and their records. */
export interface ArchivedData {
  courses: Course[];
  scheduleItems: ScheduleItem[];
  contacts: Contact[];
  sources: Source[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
}

const NONE: ArchivedData = {
  courses: [],
  scheduleItems: [],
  contacts: [],
  sources: [],
  flashcards: [],
  quizzes: [],
  quizAttempts: [],
};

/**
 * Splits the full app state into the part in use and the archived part. The
 * `state` returned is what every screen reads, so a course the student has
 * archived, and everything that belongs to it, is absent from all of them by
 * construction rather than by each screen remembering to filter.
 *
 * With nothing archived the original arrays come back unchanged, so there is
 * no extra rendering for a student who does not use archive.
 */
export function useActiveView(full: AppState): { state: AppState; archived: ArchivedData } {
  // The ids, serialized: the set below is rebuilt only when the archived
  // courses change, not on every unrelated course edit, so the filtered
  // arrays further down keep their identity.
  const idsKey = useMemo(
    () => JSON.stringify(Array.from(archivedCourseIds(full.courses)).sort()),
    [full.courses],
  );
  const stableIds = useMemo(() => new Set<string>(JSON.parse(idsKey)), [idsKey]);

  const courses = useMemo(
    () => (stableIds.size === 0 ? full.courses : full.courses.filter((c) => !isArchived(c))),
    [full.courses, stableIds],
  );
  const scheduleItems = useMemo(
    () => withoutArchivedRecords(full.scheduleItems, stableIds),
    [full.scheduleItems, stableIds],
  );
  const contacts = useMemo(
    () => withoutArchivedRecords(full.contacts, stableIds),
    [full.contacts, stableIds],
  );
  const sources = useMemo(
    () => withoutArchivedRecords(full.sources, stableIds),
    [full.sources, stableIds],
  );
  const flashcards = useMemo(
    () => withoutArchivedRecords(full.flashcards, stableIds),
    [full.flashcards, stableIds],
  );
  const quizzes = useMemo(
    () => withoutArchivedRecords(full.quizzes, stableIds),
    [full.quizzes, stableIds],
  );
  const quizAttempts = useMemo(
    () => withoutArchivedRecords(full.quizAttempts, stableIds),
    [full.quizAttempts, stableIds],
  );
  const selectedCourseId =
    full.selectedCourseId && stableIds.has(full.selectedCourseId) ? null : full.selectedCourseId;

  const state = useMemo<AppState>(
    () =>
      stableIds.size === 0
        ? full
        : {
            ...full,
            courses,
            scheduleItems,
            contacts,
            sources,
            flashcards,
            quizzes,
            quizAttempts,
            selectedCourseId,
          },
    [
      full,
      stableIds,
      courses,
      scheduleItems,
      contacts,
      sources,
      flashcards,
      quizzes,
      quizAttempts,
      selectedCourseId,
    ],
  );

  const archived = useMemo<ArchivedData>(
    () =>
      stableIds.size === 0
        ? NONE
        : {
            courses: full.courses.filter(isArchived),
            scheduleItems: onlyArchivedRecords(full.scheduleItems, stableIds),
            contacts: onlyArchivedRecords(full.contacts, stableIds),
            sources: onlyArchivedRecords(full.sources, stableIds),
            flashcards: onlyArchivedRecords(full.flashcards, stableIds),
            quizzes: onlyArchivedRecords(full.quizzes, stableIds),
            quizAttempts: onlyArchivedRecords(full.quizAttempts, stableIds),
          },
    [full, stableIds],
  );

  return { state, archived };
}
