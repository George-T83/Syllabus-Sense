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

/** Minimum gradeWeight (%) for the weight pill to show at all (TA-1). Below
 * this, an item is treated as trivial/ungraded-in-effect and the pill would
 * just be noise next to every row; at/above it, the item is worth calling
 * out at a glance since it meaningfully moves the course grade. */
export const GRADE_WEIGHT_BADGE_THRESHOLD = 15;

/** Small "worth N%" pill shown next to a row's title, but only once a task
 * is weighted heavily enough to matter (see GRADE_WEIGHT_BADGE_THRESHOLD) -
 * a 2% reading-check shouldn't visually compete with a 25% midterm. */
function GradeWeightPill({ gradeWeight }: { gradeWeight: number | undefined }) {
  if (gradeWeight === undefined || gradeWeight < GRADE_WEIGHT_BADGE_THRESHOLD) return null;
  return (
    <span
      className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary"
      title={`Worth ${gradeWeight}% of your grade`}
    >
      {gradeWeight}%
    </span>
  );
}

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
  /** Weight of this item toward the course's final grade, as a percentage
   * (ScheduleItem.gradeWeight). Optional/additive - omit at call-sites that
   * don't have it and nothing changes. Renders a small "N%" pill next to
   * the title, but only once it clears GRADE_WEIGHT_BADGE_THRESHOLD, so
   * this stays a signal for genuinely high-stakes work (an exam, a big
   * project) rather than noise on every graded item. */
  gradeWeight?: number;
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
  gradeWeight,
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
        priority={priority}
        onToggleComplete={onToggleComplete}
        trailing={trailing}
        href={href}
        gradeWeight={gradeWeight}
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
      gradeWeight={gradeWeight}
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
  gradeWeight,
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
    | 'gradeWeight'
  >) {
  const status = getTaskStatus({ completed, progress });
  const progressPct = clampProgress(progress ?? 0);
  const checkAnim = useCheckAnimState(completed);
  // flex-wrap (not a single unbreakable line): once the checkbox+icon+title
  // group and the trailing Overdue/Due/Edit/Delete group can't both fit on
  // one line at a narrow width, trailing wraps entirely onto its own line
  // below rather than the two groups fighting for the same line and either
  // overflowing (pre-fix) or overlapping (MO-1).
  const rowClass = cn(
    'flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-border/60 p-3',
    href && 'transition-colors hover:border-border',
    checkAnim === 'checked' && 'animate-task-row-glow',
  );

  const content = (
    <>
      {/* checkbox + course icon + title/meta as a single flex item (not
       * three separate ones) so the outer row's flex-wrap always keeps them
       * together and only ever wraps `trailing` away as a whole unit. */}
      <div className="flex min-w-0 flex-auto items-start gap-3">
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
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 16 16"
                role="img"
                aria-label="High priority"
              >
                <title>High priority</title>
                <path d="M8 1.5l7 12.5H1z" fill="hsl(0 84% 60%)" />
                <rect x="7.25" y="6" width="1.5" height="4" rx="0.75" fill="white" />
                <circle cx="8" cy="11.5" r="0.9" fill="white" />
              </svg>
            )}
            {priority === 'medium' && !completed && (
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 16 16"
                role="img"
                aria-label="Medium priority"
              >
                <title>Medium priority</title>
                <path d="M8 1.5l7 12.5H1z" fill="hsl(38 92% 50%)" />
              </svg>
            )}
            {priority === 'low' && !completed && (
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 16 16"
                role="img"
                aria-label="Low priority"
              >
                <title>Low priority</title>
                <circle cx="8" cy="8" r="6.5" fill="hsl(142 71% 40%)" />
              </svg>
            )}
            <div
              className={cn(
                'text-sm font-medium truncate',
                completed ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {title}
            </div>
            {!completed && <GradeWeightPill gradeWeight={gradeWeight} />}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{metaLine(courseCode, type)}</div>
          {status === 'in_progress' && <ProgressStrip percent={progressPct} />}
        </div>
      </div>
      {trailing && (
        // A sibling of the checkbox/icon/title group above (not nested
        // inside it) so the outer row's flex-wrap can drop this whole block
        // onto its own line at a narrow width (MO-1), instead of it either
        // overflowing (shrink-0) or fighting the title for the same line.
        <div
          className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
          onClick={(e) => e.stopPropagation()}
        >
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

/** Same three priority glyphs as CardRow (see there for the color
 * rationale) - kept in sync so 'touch' rows carry the same at-a-glance
 * priority signal as 'card' rows instead of dropping it entirely (TA-4). */
function PriorityGlyph({
  priority,
  completed,
  className,
}: {
  priority: Priority | undefined;
  completed: boolean;
  className: string;
}) {
  if (completed || !priority) return null;
  if (priority === 'high') {
    return (
      <svg className={className} viewBox="0 0 16 16" role="img" aria-label="High priority">
        <title>High priority</title>
        <path d="M8 1.5l7 12.5H1z" fill="hsl(0 84% 60%)" />
        <rect x="7.25" y="6" width="1.5" height="4" rx="0.75" fill="white" />
        <circle cx="8" cy="11.5" r="0.9" fill="white" />
      </svg>
    );
  }
  if (priority === 'medium') {
    return (
      <svg className={className} viewBox="0 0 16 16" role="img" aria-label="Medium priority">
        <title>Medium priority</title>
        <path d="M8 1.5l7 12.5H1z" fill="hsl(38 92% 50%)" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 16 16" role="img" aria-label="Low priority">
      <title>Low priority</title>
      <circle cx="8" cy="8" r="6.5" fill="hsl(142 71% 40%)" />
    </svg>
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
  priority,
  onToggleComplete,
  trailing,
  href,
  gradeWeight,
}: Required<Pick<TaskRowProps, 'title' | 'type' | 'completed'>> &
  Pick<
    TaskRowProps,
    | 'courseCode'
    | 'courseColor'
    | 'courseIcon'
    | 'progress'
    | 'priority'
    | 'onToggleComplete'
    | 'trailing'
    | 'href'
    | 'gradeWeight'
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
      {/* flex-wrap, and checkbox+icon+title grouped into one flex item: see
       * CardRow above for why (MO-1) - trailing wraps to its own line as a
       * whole unit at a narrow width instead of overflowing or overlapping. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
        <div className="flex min-w-0 flex-auto items-center gap-3">
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
            <div className="flex items-center gap-1.5">
              <PriorityGlyph
                priority={priority}
                completed={completed}
                className="h-3.5 w-3.5 shrink-0"
              />
              <div
                className={cn(
                  'text-sm font-semibold truncate',
                  completed ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {title}
              </div>
              {!completed && <GradeWeightPill gradeWeight={gradeWeight} />}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{metaLine(courseCode, type)}</div>
            {status === 'in_progress' && <ProgressStrip percent={progressPct} />}
          </div>
        </div>
        {trailing && (
          <div
            className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
            onClick={(e) => e.stopPropagation()}
          >
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
