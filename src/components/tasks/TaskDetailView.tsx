'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
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
/** How long to let a drag settle before writing to Firestore, so dragging
 * across the slider fires one write instead of one per tick. */
const COMMIT_DEBOUNCE_MS = 400;

const dueDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

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
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      handleSetProgress(value);
      commitTimer.current = null;
      setDraftProgress(null);
    }, COMMIT_DEBOUNCE_MS);
  };

  const progressPct = clampProgress(item.progress ?? 0);
  // The slider's own value while dragging/settling, so the ring, the %
  // label, and the remaining-hours estimate all track the drag live
  // instead of waiting for the debounced write to land.
  const displayProgress = draftProgress ?? progressPct;
  const isTracking = trackingOpen || progressPct > 0;
  const remainingHoursAt = (pct: number) =>
    item.estimatedHours != null
      ? Math.round(item.estimatedHours * (1 - pct / 100) * 10) / 10
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
      <div className="max-w-2xl space-y-6">
        <BackLink href="/tasks">Back to tasks</BackLink>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                course?.color || 'bg-primary',
              )}
            >
              <CourseIconGlyph icon={course?.icon} className="h-5 w-5" />
            </span>
            <div>
              <h1
                className={cn(
                  'text-2xl font-bold tracking-tight text-foreground',
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
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={handleToggleComplete}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Done
          </label>
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

        {!item.completed && (
          <div className="border-t border-border pt-5">
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
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Progress</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      displayProgress > 0
                        ? 'bg-primary/10 text-primary'
                        : 'bg-accent text-muted-foreground',
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
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={PROGRESS_STEP}
                    value={displayProgress}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    disabled={!user}
                    aria-label="Task progress percentage"
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-accent accent-primary disabled:cursor-not-allowed"
                  />
                </div>
                {remainingHoursAt(displayProgress) !== null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {displayProgress > 0
                      ? `~${remainingHoursAt(displayProgress)}h of estimated effort left - your workload forecast already counts only the remainder.`
                      : `Estimated at ${item.estimatedHours}h. Drag the slider and your workload forecast will count only what's left.`}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Due</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {dueDateFormatter.format(new Date(item.dueDate))}
            </dd>
          </div>
          {item.estimatedHours !== undefined && (
            <div>
              <dt className="text-xs text-muted-foreground">Estimated effort</dt>
              <dd className="mt-0.5 font-medium text-foreground">{item.estimatedHours}h</dd>
            </div>
          )}
        </dl>

        {item.notes && (
          <div className="border-t border-border pt-5">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.notes}</dd>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
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
              <button onClick={() => setConfirmingDelete(true)} className={destructiveButtonClass}>
                Delete
              </button>
            )}
          </div>
        </div>
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
