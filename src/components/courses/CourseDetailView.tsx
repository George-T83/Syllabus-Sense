'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateCourse, deleteCourse } from '@/lib/firestore/courses';
import {
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '@/lib/firestore/scheduleItems';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { SyllabusUploader } from '@/components/syllabus/SyllabusUploader';
import { SyllabusList } from '@/components/syllabus/SyllabusList';
import { formatTimeLabel } from '@/lib/calendar/meetings';
import { buildICSFilename, createICSBlob, generateICS } from '@/lib/export/ics';
import { generateRateMyProfessorUrl } from '@/lib/export/rateMyProfessor';
import { cn } from '@/lib/utils';
import type { CourseFormValues } from '@/lib/validation/course';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CourseDetailView({ courseId }: { courseId: string }) {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const router = useRouter();

  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [confirmingDeleteCourse, setConfirmingDeleteCourse] = useState(false);
  const [confirmingDeleteItemId, setConfirmingDeleteItemId] = useState<string | null>(null);

  const course = state.courses.find((c) => c.id === courseId);
  const items = state.scheduleItems
    .filter((item) => item.courseId === courseId)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const completedCount = useMemo(() => items.filter((i) => i.completed).length, [items]);
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const rmpUrl = useMemo(
    () => generateRateMyProfessorUrl(course?.instructor),
    [course?.instructor],
  );

  if (!course) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          This course doesn&apos;t exist or has been removed.
        </p>
        <BackLink href="/dashboard">Back to dashboard</BackLink>
      </div>
    );
  }

  const handleEditCourse = async (values: CourseFormValues) => {
    if (!user) throw new Error('You must be signed in to edit a course.');
    await updateCourse(
      user.uid,
      course,
      {
        ...course,
        code: values.code,
        title: values.title,
        color: values.color,
        meetingTimes: values.meetingTimes ?? [],
        ...(values.instructor ? { instructor: values.instructor } : {}),
        ...(values.term ? { term: values.term } : {}),
        ...(values.modality ? { modality: values.modality } : {}),
      },
      dispatch,
    );
  };

  const handleDeleteCourse = async () => {
    if (!user) return;
    await deleteCourse(user.uid, course, items, dispatch);
    router.push('/dashboard');
  };

  const handleAddTask = async (values: ScheduleItemFormValues) => {
    if (!user) throw new Error('You must be signed in to add a task.');
    await createScheduleItem(
      user.uid,
      {
        id: crypto.randomUUID(),
        title: values.title,
        type: values.type,
        courseId: course.id,
        dueDate: new Date(`${values.dueDate}T23:59:00`).toISOString(),
        completed: false,
        priority: values.priority,
        ...(values.estimatedHours ? { estimatedHours: Number(values.estimatedHours) } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      dispatch,
    );
  };

  const handleEditTask = async (values: ScheduleItemFormValues) => {
    if (!user || !editingItem) throw new Error('You must be signed in to edit a task.');
    await updateScheduleItem(
      user.uid,
      editingItem,
      {
        ...editingItem,
        title: values.title,
        type: values.type,
        courseId: values.courseId,
        dueDate: new Date(`${values.dueDate}T23:59:00`).toISOString(),
        priority: values.priority,
        ...(values.estimatedHours ? { estimatedHours: Number(values.estimatedHours) } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      dispatch,
    );
  };

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
  };

  const handleDeleteTask = async (item: ScheduleItem) => {
    if (!user) return;
    await deleteScheduleItem(user.uid, item, dispatch);
    setConfirmingDeleteItemId(null);
  };

  const handleExportICS = () => {
    const ics = generateICS(items, [course], new Date());
    const blob = createICSBlob(ics);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildICSFilename(course.code);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="max-w-3xl space-y-6">
        <BackLink href="/dashboard">Back to dashboard</BackLink>

        <Card className="overflow-hidden rounded-2xl p-0">
          <div className={cn('h-2 w-full', course.color || 'bg-primary')} />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white',
                    course.color || 'bg-primary',
                  )}
                >
                  {course.code.slice(0, 1)}
                </span>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {course.code} · {course.title}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[course.instructor, course.term].filter(Boolean).join(' · ') ||
                      'No details yet'}
                  </p>
                </div>
              </div>
              {items.length > 0 && (
                <ProgressRing percent={progressPct} size={56} strokeWidth={6}>
                  <span className="text-xs font-bold text-foreground">{progressPct}%</span>
                </ProgressRing>
              )}
            </div>

            {(course.meetingTimes?.length || course.modality || rmpUrl) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {course.modality && (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {course.modality}
                  </span>
                )}
                {course.meetingTimes?.map((m, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {WEEKDAY_ABBR[m.dayOfWeek]} {formatTimeLabel(m.startTime)}–
                    {formatTimeLabel(m.endTime)}
                    {m.location ? ` · ${m.location}` : ''}
                  </span>
                ))}
                {rmpUrl && (
                  <a
                    href={rmpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    Rate My Professor
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <CardActionButton onClick={() => setEditCourseOpen(true)}>Edit</CardActionButton>
              {items.length > 0 && (
                <CardActionButton onClick={handleExportICS}>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                    />
                  </svg>
                  Export .ics
                </CardActionButton>
              )}
              <div className="ml-auto">
                {confirmingDeleteCourse ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Delete course and its tasks?</span>
                    <button
                      onClick={handleDeleteCourse}
                      className="rounded-full bg-destructive/10 px-3 py-1.5 font-semibold text-destructive transition-colors hover:bg-destructive/20"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteCourse(false)}
                      className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDeleteCourse(true)}
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Syllabus</h2>
          <SyllabusList userId={user?.uid} courseId={course.id} />
          <SyllabusUploader userId={user?.uid ?? ''} courseId={course.id} />
        </Card>

        <Card className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Tasks</h2>
            <CardActionButton variant="solid" withPlus onClick={() => setAddTaskOpen(true)}>
              Add Task
            </CardActionButton>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              title="No tasks for this course yet"
              description="Add one, or upload a syllabus above to extract tasks automatically."
              action={{ label: '+ Add Task', onClick: () => setAddTaskOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const overdue = !item.completed && new Date(item.dueDate) < new Date();
                return (
                  <TaskRow
                    key={item.id}
                    title={item.title}
                    href={'/tasks/' + item.id}
                    type={item.type}
                    courseColor={course.color}
                    completed={item.completed}
                    priority={item.priority}
                    onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                    trailing={
                      <>
                        {overdue && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            Overdue
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Due {dueDateFormatter.format(new Date(item.dueDate))}
                        </span>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                        >
                          Edit
                        </button>
                        {confirmingDeleteItemId === item.id ? (
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => handleDeleteTask(item)}
                              className="font-semibold text-destructive hover:underline"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteItemId(null)}
                              className="text-muted-foreground hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteItemId(item.id)}
                            className="text-xs font-semibold text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <CourseFormModal
        open={editCourseOpen}
        onClose={() => setEditCourseOpen(false)}
        onSubmit={handleEditCourse}
        initialCourse={course}
      />
      <TaskFormModal
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSubmit={handleAddTask}
        courses={[course]}
      />
      <TaskFormModal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditTask}
        courses={[course]}
        initialItem={editingItem ?? undefined}
      />
    </>
  );
}
