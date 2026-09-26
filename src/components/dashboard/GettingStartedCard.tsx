'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CardActionButton, CardActionLink, SyllabusIcon } from '@/components/ui/CardAction';
import { useAuth } from '@/context/AuthContext';
import { setupProgress, type SetupStepId } from '@/lib/dashboard/setupSteps';
import { cn } from '@/lib/utils';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

function dismissedKey(uid: string) {
  return `getting-started-dismissed:${uid}`;
}

const STEP_COPY: Record<SetupStepId, { title: string; detail: string }> = {
  course: {
    title: 'Add your courses',
    detail:
      "Upload a syllabus and we'll draft the course, every deadline, and what each one is worth, for you to check. Or add a course by hand.",
  },
  deadlines: {
    title: 'Get your deadlines in',
    detail:
      'Assignments, quizzes, and exams with their due dates. A syllabus upload does this in one go.',
  },
  weights: {
    title: 'Say what each one is worth',
    detail:
      'With grade weights on your work, the dashboard ranks your week by what actually moves your grade.',
  },
  flashcards: {
    title: 'Make flashcards for your next exam',
    detail:
      "Generated from your syllabus and reviewed with spaced repetition, so you're ready on exam day.",
  },
};

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export interface GettingStartedCardProps {
  courses: Course[];
  scheduleItems: ScheduleItem[];
  flashcards: Flashcard[];
  onUploadSyllabus: () => void;
  onAddCourse: () => void;
  onAddTask: () => void;
  /** From useSetupChecklistDismissed - lifted so the dashboard can tell
   * whether the checklist is on screen. */
  dismissed: boolean;
  onDismiss: () => void;
}

/** Whether the student hid the checklist, remembered per account on this
 * device. Only honoured once they have a course - before that, the
 * checklist is the whole dashboard. */
export function useSetupChecklistDismissed(): [boolean, () => void] {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (!user || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(dismissedKey(user.uid)) === 'true';
    } catch {
      return false;
    }
  });
  const dismiss = () => {
    setDismissed(true);
    if (!user) return;
    try {
      window.localStorage.setItem(dismissedKey(user.uid), 'true');
    } catch {
      // Non-fatal: the checklist just comes back next visit.
    }
  };
  return [dismissed, dismiss];
}

/**
 * The first-run path: four steps from an empty account to a dashboard that
 * earns its keep, each ticking itself off from real data. For a student
 * with no courses it's the whole dashboard (nothing else has anything to
 * say yet); once there's a course it can be dismissed, and it disappears
 * for good when every step is done.
 */
export function GettingStartedCard({
  courses,
  scheduleItems,
  flashcards,
  onUploadSyllabus,
  onAddCourse,
  onAddTask,
  dismissed,
  onDismiss,
}: GettingStartedCardProps) {
  const progress = setupProgress(courses, scheduleItems, flashcards);
  const canDismiss = courses.length > 0;
  if (progress.complete || (dismissed && canDismiss)) return null;

  const total = progress.steps.length;
  const headline =
    progress.doneCount === 0
      ? "Let's set up your semester"
      : `${progress.doneCount} of ${total} done. Next: ${STEP_COPY[progress.next!].title.toLowerCase()}`;

  const actionsFor = (id: SetupStepId): ReactNode => {
    switch (id) {
      case 'course':
        return (
          <>
            <CardActionButton variant="primary" onClick={onUploadSyllabus}>
              <SyllabusIcon />
              Upload a syllabus
            </CardActionButton>
            <CardActionButton withPlus onClick={onAddCourse}>
              Add by hand
            </CardActionButton>
          </>
        );
      case 'deadlines':
        return (
          <>
            <CardActionButton variant="primary" onClick={onUploadSyllabus}>
              <SyllabusIcon />
              Upload a syllabus
            </CardActionButton>
            <CardActionButton withPlus onClick={onAddTask}>
              Add a deadline
            </CardActionButton>
          </>
        );
      case 'weights':
        return (
          <CardActionLink href="/tasks" withChevron>
            Open your tasks
          </CardActionLink>
        );
      case 'flashcards':
        return (
          <CardActionLink href="/flashcards" withChevron>
            Go to flashcards
          </CardActionLink>
        );
    }
  };

  return (
    <Card className="rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Get set up
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground">
            {headline}
          </h2>
          {progress.doneCount === 0 && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Four steps, a couple of minutes. One syllabus upload covers the first three.
            </p>
          )}
        </div>
        {canDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Hide the setup checklist"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={progress.doneCount}
        aria-valuetext={`${progress.doneCount} of ${total} steps done`}
      >
        <div
          className="h-full rounded-full bg-gradient-brand transition-[width] duration-500"
          style={{ width: `${(progress.doneCount / total) * 100}%` }}
        />
      </div>

      <ol aria-label="Setup steps" className="mt-5 space-y-1">
        {progress.steps.map((step, i) => {
          const copy = STEP_COPY[step.id];
          const isNext = step.id === progress.next;
          return (
            <li key={step.id} className={cn('flex gap-3 rounded-xl p-3', isNext && 'bg-primary/5')}>
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step.done
                    ? 'bg-[#00a88c] text-white'
                    : isNext
                      ? 'bg-primary text-primary-foreground'
                      : 'border-2 border-border text-muted-foreground',
                )}
              >
                {step.done ? <CheckIcon /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    step.done ? 'text-muted-foreground line-through' : 'text-foreground',
                  )}
                >
                  {copy.title}
                  <span className="sr-only">{step.done ? ', done' : isNext ? ', next' : ''}</span>
                </p>
                {isNext && (
                  <>
                    <p className="mt-0.5 text-sm text-muted-foreground">{copy.detail}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {actionsFor(step.id)}
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {courses.length === 0 && (
        <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          Once your deadlines are in, this page turns into your week: what&apos;s due, what
          it&apos;s worth, and when to start.{' '}
          <Link href="/degree-compass" className="font-medium text-primary hover:underline">
            Planning your whole degree?
          </Link>
        </p>
      )}
    </Card>
  );
}
