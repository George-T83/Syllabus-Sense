'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateScheduleItem, deleteScheduleItem } from '@/lib/firestore/scheduleItems';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { CourseIconGlyph } from '@/components/ui/CourseIconGlyph';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '@/lib/export/calendarLinks';
import { clampProgress, TASK_STATUS_LABEL } from '@/lib/taskStatus';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { AssignmentType } from '@/types/schedule';
import { cn } from '@/lib/utils';

/** 5-point steps rather than 1% - self-reported task progress is never
 * that precise, and 1% increments would turn a drag into 100 discrete
 * writes' worth of visual noise for no real gain in accuracy. */
const PROGRESS_STEP = 5;
/** How long to let a drag/keystroke settle before writing to Firestore, so
 * dragging the slider or typing an hour value fires one write instead of
 * one per tick/keystroke. */
const COMMIT_DEBOUNCE_MS = 400;

const dueDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** Which workload-ramp CSS var a given progress percentage should render
 * as, for the slider's fill/thumb color. Quartile-banded rather than a
 * continuous gradient so the color reads as a discrete signal ("just
 * crossed into the next band") instead of a smear. */
function progressColorVar(pct: number): string {
  if (pct >= 75) return '--load-low';
  if (pct >= 50) return '--load-medium';
  if (pct >= 25) return '--load-high';
  return '--load-critical';
}

const TYPE_LABELS: Record<AssignmentType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  project: 'Project',
  reading: 'Reading',
  other: 'Other',
};

const solidButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90';
const outlineButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent';
const destructiveButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20';

export function TaskDetailView({ taskId }: { taskId: string }) {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Local-only "I want to track this" flag - separate from the task's
   * actual progress, so opening the slider doesn't itself write anything
   * until the student actually moves it above 0. */
  const [trackingOpen, setTrackingOpen] = useState(false);
  /** The slider's live value while a drag/commit is in flight, so the UI
   * feels instant even though the Firestore write is debounced. null once
   * settled, at which point the committed item.progress is authoritative. */
  const [draftProgress, setDraftProgress] = useState<number | null>(null);
  const progressCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Purely visual - whether the slider's thumb should render in its
   * "active" (larger, haloed) state. Driven by pointer down/up on the real
   * input, independent of the debounce/commit state above. */
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  /** Same pattern as draftProgress, for the estimated-effort input - the
   * raw text the student is typing, kept separate so a half-typed "1."
   * doesn't get coerced mid-keystroke. null once the debounced write lands. */
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);
  const hoursCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const item = state.scheduleItems.find((i) => i.id === taskId);
  const course = item ? state.courses.find((c) => c.id === item.courseId) : undefined;

  if (!item) {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          This task doesn&apos;t exist or has been removed.
        </p>
        <BackLink href="/tasks">Back to tasks</BackLink>
      </div>
    );
  }

  const overdue = !item.completed && new Date(item.dueDate) < new Date();

  const handleToggleComplete = async () => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
  };

  const handleSetProgress = async (value: number) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, progress: clampProgress(value) }, dispatch);
  };

  const handleSliderChange = (value: number) => {
    setDraftProgress(value);
    if (progressCommitTimer.current) clearTimeout(progressCommitTimer.current);
    progressCommitTimer.current = setTimeout(() => {
      handleSetProgress(value);
      progressCommitTimer.current = null;
      setDraftProgress(null);
    }, COMMIT_DEBOUNCE_MS);
  };

  const handleSetEstimatedHours = async (value: number) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, estimatedHours: value }, dispatch);
  };

  const handleHoursInputChange = (raw: string) => {
    setHoursDraft(raw);
    if (hoursCommitTimer.current) clearTimeout(hoursCommitTimer.current);
    hoursCommitTimer.current = setTimeout(() => {
      const parsed = Number(raw);
      if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
        handleSetEstimatedHours(Math.round(parsed * 10) / 10);
      }
      hoursCommitTimer.current = null;
      setHoursDraft(null);
    }, COMMIT_DEBOUNCE_MS);
  };

  const progressPct = clampProgress(item.progress ?? 0);
  // The slider's own value while dragging/settling, so the ring, the %
  // label, and the remaining-hours estimate all track the drag live
  // instead of waiting for the debounced write to land.
  const displayProgress = draftProgress ?? progressPct;
  const isTracking = trackingOpen || progressPct > 0;
  // Same idea for the hours field: reflect what's being typed immediately,
  // even before the debounced write (or a still-invalid partial number)
  // has landed.
  const displayHoursText =
    hoursDraft ?? (item.estimatedHours != null ? String(item.estimatedHours) : '');
  const effectiveEstimatedHours =
    hoursDraft !== null ? Number(hoursDraft) || item.estimatedHours : item.estimatedHours;
  const remainingHoursAt = (pct: number) =>
    effectiveEstimatedHours != null
      ? Math.round(effectiveEstimatedHours * (1 - pct / 100) * 10) / 10
      : null;

  const handleEditTask = async (values: ScheduleItemFormValues) => {
    if (!user) throw new Error('You must be signed in to edit a task.');
    await updateScheduleItem(
      user.uid,
      item,
      {
        ...item,
        title: values.title,
        type: values.type,
        courseId: values.courseId,
        dueDate: new Date(`${values.dueDate}T23:59:00`).toISOString(),
        priority: values.priority,
        ...(values.estimatedHours ? { estimatedHours: Number(values.estimatedHours) } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        ...(values.progress ? { progress: Number(values.progress) } : {}),
      },
      dispatch,
    );
  };

  const handleDelete = async () => {
    if (!user) return;
    await deleteScheduleItem(user.uid, item, dispatch);
    router.push('/tasks');
  };

  return (
    <>
      <div className="max-w-2xl space-y-4">
        <BackLink href="/tasks">Back to tasks</BackLink>

        <Card className="divide-y divide-border" accent>
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm',
                  course?.color || 'bg-primary',
                )}
              >
                <CourseIconGlyph icon={course?.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1
                  className={cn(
                    'text-2xl font-bold leading-tight tracking-tight text-foreground',
                    item.completed && 'text-muted-foreground line-through',
                  )}
                >
                  {item.title}
                </h1>
                {course && (
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    {course.code} · {course.title}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {TYPE_LABELS[item.type]}
              </span>
              {item.priority && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                  {item.priority} priority
                </span>
              )}
              {overdue && (
                <span className="rounded-full bg-load-critical/10 px-2.5 py-1 text-xs font-semibold text-load-critical">
                  Overdue
                </span>
              )}
              {item.gradeWeight !== undefined && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {item.gradeWeight}% of grade{item.gradeCategory ? ` · ${item.gradeCategory}` : ''}
                </span>
              )}
              {item.source === 'ai' && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  From syllabus
                </span>
              )}
            </div>
          </div>

          {/* The single most important action on this page gets a full-width
           * button of its own instead of a small corner checkbox, so
           * marking a task done (or undoing that) is unmissable. */}
          <div className="p-6">
            <button
              type="button"
              onClick={handleToggleComplete}
              disabled={!user}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                item.completed
                  ? 'border-load-low/40 bg-load-low/10 text-load-low hover:bg-load-low/15'
                  : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
              )}
            >
              {item.completed ? (
                <>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Done - tap to undo
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Mark as done
                </>
              )}
            </button>
          </div>

          {!item.completed && (
            <div className="p-6">
              {!isTracking ? (
                // Nothing logged yet: no ring, no "0%" - the task is simply
                // done or not done until the student opts into tracking it.
                <button
                  type="button"
                  onClick={() => setTrackingOpen(true)}
                  disabled={!user}
                  className="flex items-center gap-2 text-xs font-semibold text-primary transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Track progress
                </button>
              ) : (
                <div className="rounded-xl bg-accent/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Progress</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        displayProgress > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-card text-muted-foreground',
                      )}
                    >
                      {displayProgress > 0
                        ? TASK_STATUS_LABEL.in_progress
                        : TASK_STATUS_LABEL.not_started}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <ProgressRing percent={displayProgress} size={52} strokeWidth={6}>
                      <span className="text-xs font-bold text-foreground">{displayProgress}%</span>
                    </ProgressRing>
                    {/* Custom visual layer over a real native range input -
                     * see the wrapper below for why the layering order
                     * matters (input must stay topmost, everything else
                     * pointer-events: none). */}
                    <div className={cn('relative h-11 flex-1', !user && 'opacity-50')}>
                      {/* Ticks at 25/50/75%. z-2: above the track/fill/thumb,
                       * below the real input. */}
                      {[25, 50, 75].map((tick) => (
                        <span
                          key={tick}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 z-[2] w-px -translate-x-1/2 -translate-y-1/2 bg-[rgba(0,0,0,0.28)] dark:bg-[rgba(255,255,255,0.32)]"
                          style={{ left: `${tick}%`, height: 6 }}
                        />
                      ))}

                      {/* Track + fill. Width is set imperatively (not
                       * transitioned) so a fast drag never lags behind the
                       * pointer - only the fill's color eases across
                       * quartile boundaries. */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 right-0 top-1/2 z-[1] h-2 -translate-y-1/2 overflow-hidden rounded-full bg-card"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${displayProgress}%`,
                            backgroundColor: `hsl(var(${progressColorVar(displayProgress)}))`,
                            transition: 'background-color 150ms ease-out',
                          }}
                        />
                      </div>

                      {/* Decorative thumb, tracking the fill's edge. Grows
                       * and gains a halo while dragging; position itself is
                       * never transitioned, for the same lag-avoidance
                       * reason as the fill above. */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute z-[1] rounded-full border-2 border-card shadow-sm"
                        style={{
                          top: '50%',
                          left: `calc(${displayProgress}% - ${(isDraggingProgress ? 20 : 16) / 2}px)`,
                          width: isDraggingProgress ? 20 : 16,
                          height: isDraggingProgress ? 20 : 16,
                          transform: 'translateY(-50%)',
                          backgroundColor: `hsl(var(${progressColorVar(displayProgress)}))`,
                          boxShadow: isDraggingProgress
                            ? `0 0 0 6px hsl(var(${progressColorVar(displayProgress)}) / 0.28)`
                            : undefined,
                          transition:
                            'width 120ms cubic-bezier(0.34, 1.56, 0.64, 1), height 120ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      />

                      {/* The actual interactive/accessible element. Fully
                       * transparent and absolutely positioned over the
                       * whole wrapper (a real 44px tall hit area, not just
                       * the ~8-20px of visible track), and given the
                       * HIGHEST z-index of every layer here on purpose: if
                       * a decorative layer above it were ever topmost, it
                       * would silently swallow all pointer events and the
                       * slider would stop being interactive - that bug has
                       * shipped once already. */}
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={PROGRESS_STEP}
                        value={displayProgress}
                        onChange={(e) => handleSliderChange(Number(e.target.value))}
                        onPointerDown={() => setIsDraggingProgress(true)}
                        onPointerUp={() => setIsDraggingProgress(false)}
                        onPointerCancel={() => setIsDraggingProgress(false)}
                        onBlur={() => setIsDraggingProgress(false)}
                        disabled={!user}
                        aria-label="Task progress percentage"
                        className="absolute inset-0 z-[3] w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  {remainingHoursAt(displayProgress) !== null && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {displayProgress > 0
                        ? `~${remainingHoursAt(displayProgress)}h of estimated effort left - your workload forecast already counts only the remainder.`
                        : `Estimated at ${effectiveEstimatedHours}h. Drag the slider and your workload forecast will count only what's left.`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 p-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Due</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {dueDateFormatter.format(new Date(item.dueDate))}
              </dd>
            </div>
            <div>
              <label htmlFor="task-estimated-hours" className="text-xs text-muted-foreground">
                Estimated effort
              </label>
              {/* Always editable, not just displayed - the first estimate is
               * often a guess, and a special case (a longer reading than
               * usual, a group project that fell through) should be a
               * two-second fix, not a trip through the full edit form. */}
              <div className="mt-0.5 flex items-center gap-1">
                <input
                  id="task-estimated-hours"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={displayHoursText}
                  onChange={(e) => handleHoursInputChange(e.target.value)}
                  disabled={!user}
                  placeholder="Add"
                  aria-label="Estimated effort in hours"
                  className="w-14 rounded-md border border-transparent bg-transparent font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:border-border focus:bg-card focus:px-1.5 focus:py-0.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                />
                <span className="text-sm font-medium text-muted-foreground">h</span>
              </div>
            </div>
          </div>

          {item.notes && (
            <div className="p-6">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.notes}</dd>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 p-6">
            <button onClick={() => setEditOpen(true)} className={solidButtonClass}>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
            <a
              href={generateGoogleCalendarUrl(item, course)}
              target="_blank"
              rel="noopener noreferrer"
              className={outlineButtonClass}
            >
              Google Calendar
            </a>
            <a
              href={generateOutlookCalendarUrl(item, course)}
              target="_blank"
              rel="noopener noreferrer"
              className={outlineButtonClass}
            >
              Outlook
            </a>
            <div className="ml-auto">
              {confirmingDelete ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Delete this task?</span>
                  <button
                    onClick={handleDelete}
                    className="rounded-lg bg-destructive px-3.5 py-2 font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
                  >
                    Confirm
                  </button>
                  <button onClick={() => setConfirmingDelete(false)} className={outlineButtonClass}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className={destructiveButtonClass}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <TaskFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditTask}
        courses={state.courses}
        initialItem={item}
      />
    </>
  );
}
