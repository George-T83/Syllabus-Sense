'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { courseChipTint, courseSwatch, courseWash } from '@/lib/courseColors';
import { clampProgress, getTaskStatus } from '@/lib/taskStatus';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CourseIconGlyph } from '@/components/ui/CourseIconGlyph';
import type { AssignmentType, Priority } from '@/types/schedule';

const TYPE_LABEL: Record<AssignmentType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  project: 'Project',
  reading: 'Reading',
  other: 'Other',
};

type CheckAnimState = 'idle' | 'checked' | 'unchecked';

/** Time to hold the 'checked' animation state open: long enough for the
 * pop (480ms), the later of the two staggered ripple rings (80ms delay +
 * 500ms = 580ms), and the checkmark reveal (70ms delay + 150ms = 220ms) to
 * all finish before the transient classes are torn down. */
const CHECK_ANIM_HOLD_MS = 580;
const UNCHECK_ANIM_HOLD_MS = 100;

/** Tracks the transient completion-animation state for a checkbox:
 * 'checked' for a moment right after a task is marked done (pop + ripple +
 * checkmark reveal + row glow), 'unchecked' for a moment right after it's
 * marked undone (quick checkmark fade, no ripple/glow), 'idle' otherwise.
 * Skips animating on first mount so a task that's already completed when
 * the row renders doesn't replay the completion animation. */
function useCheckAnimState(completed: boolean): CheckAnimState {
  const [animState, setAnimState] = useState<CheckAnimState>('idle');
  const prevCompleted = useRef(completed);

  useEffect(() => {
    if (prevCompleted.current === completed) return;
    prevCompleted.current = completed;
    const nextState: CheckAnimState = completed ? 'checked' : 'unchecked';
    setAnimState(nextState);
    const timer = setTimeout(
      () => setAnimState('idle'),
      completed ? CHECK_ANIM_HOLD_MS : UNCHECK_ANIM_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [completed]);

  return animState;
}

export interface TaskRowProps {
  title: string;
  type?: AssignmentType;
  courseCode?: string;
  courseColor?: string;
  /** One of COURSE_ICON_PRESETS (lib/courseIcons.ts). Missing/unrecognized
   * values resolve to the default glyph via CourseIconGlyph. */
  courseIcon?: string;
  completed?: boolean;
  /** Self-reported completion progress, 0-100. Undefined/0 with `completed`
   * false renders as not-started (no visual change - no progress UI shows
   * at all until a task actually has some); a value above 0 shows a small
   * in-progress indicator. See lib/taskStatus.ts. */
  progress?: number;
  priority?: Priority;
  onToggleComplete?: () => void;
  /** Right-aligned custom content: due labels, badges, edit/delete links. */
  trailing?: ReactNode;
  /** When present, the row navigates to this URL on click (e.g. a task
   * detail page), while the checkbox stays independently clickable. */
  href?: string;
  /** Visual density. 'card' (default, everywhere) gives every row a
   * course-tinted background, a course-icon badge, and real breathing
   * room. 'touch' swaps the course-color surface for a top accent bar plus
   * a larger circular checkbox, for touch-first contexts (a mobile
   * calendar day view). There is no denser "compact" variant - a uniform
   * look across the app was chosen over squeezing more rows on screen. */
  variant?: 'card' | 'touch';
}

export function TaskRow({
  title,
  type = 'assignment',
  courseCode,
  courseColor,
  courseIcon,
  completed = false,
  progress,
  priority = 'medium',
  onToggleComplete,
  trailing,
  href,
  variant = 'card',
}: TaskRowProps) {
  if (variant === 'touch') {
    return (
      <TouchRow
        title={title}
        type={type}
        courseCode={courseCode}
        courseColor={courseColor}
        courseIcon={courseIcon}
        completed={completed}
        progress={progress}
        onToggleComplete={onToggleComplete}
        trailing={trailing}
        href={href}
      />
    );
  }

  return (
    <CardRow
      title={title}
      type={type}
      courseCode={courseCode}
      courseColor={courseColor}
      courseIcon={courseIcon}
      completed={completed}
      progress={progress}
      priority={priority}
      onToggleComplete={onToggleComplete}
      trailing={trailing}
      href={href}
    />
  );
}

function metaLine(courseCode: string | undefined, type: AssignmentType) {
  return courseCode ? `${courseCode} · ${TYPE_LABEL[type]}` : TYPE_LABEL[type];
}

/** Shared "in progress" strip: never renders for a task nobody has touched
 * (status stays 'not_started', not a visible "0%") - only appears once
 * progress is actually above 0, per the same not_started/in_progress/
 * completed split used everywhere else (lib/taskStatus.ts). */
function ProgressStrip({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={cn('mt-1.5 flex items-center gap-2', className)}>
      <ProgressBar percent={percent} className="max-w-32" />
      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

function CourseIconBadge({
  courseColor,
  courseIcon,
  size = 7,
}: {
  courseColor: string | undefined;
  courseIcon: string | undefined;
  size?: 6 | 7;
}) {
  const chip = courseChipTint(courseColor);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border',
        size === 7 ? 'h-7 w-7' : 'h-6 w-6',
        chip.className,
      )}
      style={chip.style}
    >
      <CourseIconGlyph icon={courseIcon} className={size === 7 ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </span>
  );
}

function CardRow({
  title,
  type,
  courseCode,
  courseColor,
  courseIcon,
  completed,
  progress,
  priority,
  onToggleComplete,
  trailing,
  href,
}: Required<Pick<TaskRowProps, 'title' | 'type' | 'completed' | 'priority'>> &
  Pick<
    TaskRowProps,
    | 'courseCode'
    | 'courseColor'
    | 'courseIcon'
    | 'progress'
    | 'onToggleComplete'
    | 'trailing'
    | 'href'
  >) {
  const status = getTaskStatus({ completed, progress });
  const progressPct = clampProgress(progress ?? 0);
  const checkAnim = useCheckAnimState(completed);
  const rowClass = cn(
    'flex items-start gap-3 rounded-xl border border-border/60 p-3',
    href && 'transition-colors hover:border-border',
    checkAnim === 'checked' && 'animate-task-row-glow',
  );

  const content = (
    <>
      {onToggleComplete && (
        <label
          className="relative flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={completed}
            onChange={onToggleComplete}
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Mark ${title} complete`}
          />
          {checkAnim === 'checked' && (
            <>
              <span
                aria-hidden="true"
                className="animate-task-check-ripple pointer-events-none absolute inset-0 m-auto h-4 w-4 rounded-full border border-primary"
              />
              <span
                aria-hidden="true"
                className="animate-task-check-ripple-delayed pointer-events-none absolute inset-0 m-auto h-4 w-4 rounded-full border border-primary"
              />
            </>
          )}
          <span
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded border-2 border-border bg-card transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card',
              completed && 'border-primary bg-primary',
              checkAnim === 'checked' && 'animate-task-check-pop',
            )}
          >
            {(completed || checkAnim === 'unchecked') && (
              <svg
                className={cn(
                  'h-2.5 w-2.5 stroke-primary-foreground',
                  checkAnim === 'checked' && 'animate-task-check-mark-in',
                  checkAnim === 'unchecked' && 'animate-task-check-mark-out',
                )}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={4}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </label>
      )}
      <CourseIconBadge courseColor={courseColor} courseIcon={courseIcon} size={7} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {priority === 'high' && !completed && (
            <svg
              className="h-2 w-2 shrink-0"
              viewBox="0 0 12 12"
              role="img"
              aria-label="High priority"
            >
              <title>High priority</title>
              <path d="M6 1l5 9H1z" fill="hsl(var(--primary))" />
            </svg>
          )}
          {priority === 'medium' && !completed && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70"
              title="Medium priority"
              aria-label="Medium priority"
            />
          )}
          <div
            className={cn(
              'text-sm font-medium truncate',
              completed ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {title}
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{metaLine(courseCode, type)}</div>
        {status === 'in_progress' && <ProgressStrip percent={progressPct} />}
      </div>
      {trailing && (
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      )}
    </>
  );

  const style = courseWash(courseColor);

  if (href) {
    return (
      <Link href={href} className={rowClass} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <div className={rowClass} style={style}>
      {content}
    </div>
  );
}

function TouchRow({
  title,
  type,
  courseCode,
  courseColor,
  courseIcon,
  completed,
  progress,
  onToggleComplete,
  trailing,
  href,
}: Required<Pick<TaskRowProps, 'title' | 'type' | 'completed'>> &
  Pick<
    TaskRowProps,
    | 'courseCode'
    | 'courseColor'
    | 'courseIcon'
    | 'progress'
    | 'onToggleComplete'
    | 'trailing'
    | 'href'
  >) {
  const status = getTaskStatus({ completed, progress });
  const progressPct = clampProgress(progress ?? 0);
  const checkAnim = useCheckAnimState(completed);
  const outerClass = cn(
    'flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-accent/30',
    href && 'transition-colors hover:bg-accent/50',
    checkAnim === 'checked' && 'animate-task-row-glow',
  );
  const swatch = courseSwatch(courseColor);

  const content = (
    <>
      <div className={cn('h-1 w-full', swatch.className)} style={swatch.style} />
      <div className="flex items-center gap-3 px-3.5 py-3">
        {onToggleComplete && (
          <label
            className="relative flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={completed}
              onChange={onToggleComplete}
              className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`Mark ${title} complete`}
            />
            {checkAnim === 'checked' && (
              <>
                <span
                  aria-hidden="true"
                  className="animate-task-check-ripple pointer-events-none absolute inset-0 m-auto h-6 w-6 rounded-full border border-primary"
                />
                <span
                  aria-hidden="true"
                  className="animate-task-check-ripple-delayed pointer-events-none absolute inset-0 m-auto h-6 w-6 rounded-full border border-primary"
                />
              </>
            )}
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card',
                completed && 'border-primary bg-primary',
                checkAnim === 'checked' && 'animate-task-check-pop',
              )}
            >
              {(completed || checkAnim === 'unchecked') && (
                <svg
                  className={cn(
                    'h-3.5 w-3.5 stroke-primary-foreground',
                    checkAnim === 'checked' && 'animate-task-check-mark-in',
                    checkAnim === 'unchecked' && 'animate-task-check-mark-out',
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          </label>
        )}
        <CourseIconBadge courseColor={courseColor} courseIcon={courseIcon} size={6} />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-sm font-semibold truncate',
              completed ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {title}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{metaLine(courseCode, type)}</div>
          {status === 'in_progress' && <ProgressStrip percent={progressPct} />}
        </div>
        {trailing && (
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {trailing}
          </div>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={outerClass}>
        {content}
      </Link>
    );
  }

  return <div className={outerClass}>{content}</div>;
}
