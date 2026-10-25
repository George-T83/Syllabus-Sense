import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';
import { withoutSample } from '@/lib/sample/sampleSemester';

export type SetupStepId = 'course' | 'deadlines' | 'weights' | 'flashcards';

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
}

export interface SetupProgress {
  steps: SetupStep[];
  doneCount: number;
  /** The first unfinished step - the one the checklist leads with. */
  next: SetupStepId | null;
  complete: boolean;
}

/**
 * How far a student is through getting set up, read straight from their
 * data rather than from a separate "onboarding done" flag - so a step ticks
 * itself off the moment a syllabus upload or a form creates what it asks
 * for, and nothing is ever marked done that isn't. Records from "Try a sample
 * semester" are made-up, so they never tick a step: loading the sample must
 * not read as "3 of 4 done", and removing it returns the checklist to the
 * student's true state.
 */
export function setupProgress(
  allCourses: Pick<Course, 'id' | 'sample'>[],
  allScheduleItems: Pick<ScheduleItem, 'gradeWeight' | 'sample'>[],
  flashcards: Pick<Flashcard, 'id'>[],
): SetupProgress {
  const courses = withoutSample(allCourses);
  const scheduleItems = withoutSample(allScheduleItems);
  const steps: SetupStep[] = [
    { id: 'course', done: courses.length > 0 },
    { id: 'deadlines', done: scheduleItems.length > 0 },
    {
      id: 'weights',
      done: scheduleItems.some((i) => typeof i.gradeWeight === 'number' && i.gradeWeight > 0),
    },
    { id: 'flashcards', done: flashcards.length > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done)?.id ?? null;
  return { steps, doneCount, next, complete: next === null };
}
