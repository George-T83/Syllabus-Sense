'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateScheduleItem, deleteScheduleItem } from '@/lib/firestore/scheduleItems';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '@/lib/export/calendarLinks';
import { ICON_PATHS } from '@/lib/icons';
import { clampProgress, getTaskStatus, TASK_STATUS_LABEL } from '@/lib/taskStatus';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { AssignmentType } from '@/types/schedule';
import { cn } from '@/lib/utils';

const PROGRESS_PRESETS = [0, 25, 50, 75, 100];

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

  const status = getTaskStatus(item);
  const progressPct = clampProgress(item.progress ?? 0);
  const remainingHours =
    item.estimatedHours != null
      ? Math.round(item.estimatedHours * (1 - progressPct / 100) * 10) / 10
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
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS.tasks} />
              </svg>
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
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  status === 'in_progress'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-accent text-muted-foreground',
                )}
              >
                {TASK_STATUS_LABEL[status]}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ProgressRing percent={progressPct} size={56} strokeWidth={6}>
                <span className="text-xs font-bold text-foreground">{progressPct}%</span>
              </ProgressRing>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {PROGRESS_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetProgress(pct)}
                    disabled={!user}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      progressPct === pct
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            {remainingHours !== null && (
              <p className="mt-3 text-xs text-muted-foreground">
                {status === 'in_progress'
                  ? `~${remainingHours}h of estimated effort left - your workload forecast already counts only the remainder.`
                  : `Estimated at ${item.estimatedHours}h. Log progress and your workload forecast will count only what's left.`}
              </p>
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
