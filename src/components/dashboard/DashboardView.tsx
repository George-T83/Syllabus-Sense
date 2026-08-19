'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CardActionLink, CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { TaskRow } from '@/components/ui/TaskRow';
import { resolveActiveTerm, useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { createCourse } from '@/lib/firestore/courses';
import { createScheduleItem, updateScheduleItem } from '@/lib/firestore/scheduleItems';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { SyllabusAutofillModal } from '@/components/syllabus/SyllabusAutofillModal';
import { computeSmartPlan, getLocalReferenceDate } from '@/lib/planner/computeSmartPlan';
import { WORKLOAD_CHIP_CLASS, WORKLOAD_TEXT_CLASS } from '@/lib/workload';
import { cn } from '@/lib/utils';
import type { CourseFormValues } from '@/lib/validation/course';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const forecastDayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

function getGreeting(hour: number): string {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);

  const { courses, scheduleItems } = state;
  const pendingTasks = scheduleItems.filter((item) => !item.completed);
  const completedTasksCount = scheduleItems.length - pendingTasks.length;
  const termProgressPct = scheduleItems.length
    ? Math.round((completedTasksCount / scheduleItems.length) * 100)
    : 0;
  const now = useMemo(() => Date.now(), []);
  const overdueCount = pendingTasks.filter((item) => new Date(item.dueDate).getTime() < now).length;

  const currentTerm = useMemo(
    () => resolveActiveTerm(state.selectedTerm, courses),
    [state.selectedTerm, courses],
  );
  const semesterCourses = currentTerm ? courses.filter((c) => c.term === currentTerm) : courses;

  const courseLoad = semesterCourses.map((course) => {
    const items = scheduleItems.filter((item) => item.courseId === course.id);
    const completed = items.filter((item) => item.completed).length;
    const pct = items.length ? Math.round((completed / items.length) * 100) : 0;
    return { course, pct };
  });

  const upcomingTasks = pendingTasks
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  const referenceDate = useMemo(() => getLocalReferenceDate(), []);
  const plan = useMemo(
    () => computeSmartPlan(scheduleItems, referenceDate),
    [scheduleItems, referenceDate],
  );
  const plannerPreview = [...plan.startToday, ...plan.startThisWeek].slice(0, 4);

  const greeting = useMemo(() => getGreeting(new Date().getHours()), []);
  const firstName = (user?.displayName || user?.email?.split('@')[0] || 'there').split(' ')[0];

  const handleAddCourse = async (values: CourseFormValues) => {
    if (!user) throw new Error('You must be signed in to add a course.');
    // Firestore's setDoc rejects `undefined` field values, so optional fields
    // are only included when they actually have a value.
    await createCourse(
      user.uid,
      {
        id: crypto.randomUUID(),
        code: values.code,
        title: values.title,
        color: values.color,
        ...(values.instructor ? { instructor: values.instructor } : {}),
        ...(values.term ? { term: values.term } : {}),
      },
      dispatch,
    );
  };

  const handleAddTask = async (values: ScheduleItemFormValues) => {
    if (!user) throw new Error('You must be signed in to add a task.');
    // Firestore's setDoc rejects `undefined` field values, so optional fields
    // are only included when they actually have a value.
    await createScheduleItem(
      user.uid,
      {
        id: crypto.randomUUID(),
        title: values.title,
        type: values.type,
        courseId: values.courseId,
        dueDate: new Date(`${values.dueDate}T23:59:00`).toISOString(),
        completed: false,
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

  return (
    <>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {greeting}, <span className="text-gradient-brand">{firstName}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {currentTerm || courses[0]?.term || 'No courses yet'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-6 text-white shadow-card">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Got a syllabus? Let Claude set it up.</h2>
              <p className="mt-1 text-sm text-white/80">
                Upload the PDF and get a course plus every assignment drafted for you to review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutofillOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-transform hover:scale-[1.02]"
            >
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
                  d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Autofill from Syllabus
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
          <Card accent className="flex flex-col items-center justify-center gap-4 rounded-2xl p-6">
            <ProgressRing percent={termProgressPct} size={116} strokeWidth={10}>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{termProgressPct}%</div>
                <div className="text-[10px] text-muted-foreground">progress</div>
              </div>
            </ProgressRing>
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-primary">{courses.length}</div>
                <div className="text-[10px] text-muted-foreground">Courses</div>
              </div>
              <div>
                <div className="text-lg font-bold text-load-medium">{pendingTasks.length}</div>
                <div className="text-[10px] text-muted-foreground">Pending</div>
              </div>
              <div>
                <div className="text-lg font-bold text-load-low">{completedTasksCount}</div>
                <div className="text-[10px] text-muted-foreground">Done</div>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <SectionIcon icon="courseLoad" />
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Course Load</h2>
                    {currentTerm && <p className="text-xs text-muted-foreground">{currentTerm}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CardActionLink href="/courses" withChevron>
                    View all
                  </CardActionLink>
                  <CardActionButton variant="solid" withPlus onClick={() => setAddCourseOpen(true)}>
                    Add Course
                  </CardActionButton>
                </div>
              </div>

              {courseLoad.length === 0 ? (
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
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  }
                  title="No courses yet"
                  description="Add one to start tracking your workload."
                  action={{ label: '+ Add Course', onClick: () => setAddCourseOpen(true) }}
                />
              ) : (
                <div className="space-y-5">
                  {courseLoad.map(({ course, pct }) => (
                    <div key={course.id}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <Link
                          href={`/courses/${course.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {course.code} · {course.title}
                        </Link>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${course.color || 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <SectionIcon icon="tasks" />
                  <h2 className="text-base font-semibold text-foreground">Upcoming Tasks</h2>
                  {overdueCount > 0 && (
                    <span className="rounded-full bg-load-critical/10 px-2 py-0.5 text-[10px] font-semibold text-load-critical">
                      {overdueCount} overdue
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <CardActionLink href="/tasks" withChevron>
                    View all
                  </CardActionLink>
                  <CardActionButton variant="solid" withPlus onClick={() => setAddTaskOpen(true)}>
                    Add Task
                  </CardActionButton>
                </div>
              </div>
              {upcomingTasks.length === 0 ? (
                <EmptyState
                  icon={
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                  title="Nothing due"
                  description="You're all caught up."
                />
              ) : (
                <div className="divide-y divide-border">
                  {upcomingTasks.map((item) => {
                    const course = courses.find((c) => c.id === item.courseId);
                    return (
                      <TaskRow
                        key={item.id}
                        title={item.title}
                        href={'/tasks/' + item.id}
                        type={item.type}
                        courseCode={course ? course.code : 'General'}
                        courseColor={course?.color}
                        completed={item.completed}
                        priority={item.priority}
                        onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                        trailing={
                          <span className="text-xs text-muted-foreground">
                            Due {dueDateFormatter.format(new Date(item.dueDate))}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        <Card className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon="forecast" />
              <h2 className="text-base font-semibold text-foreground">7-Day Load</h2>
            </div>
            <CardActionLink href="/planner" withChevron>
              Open planner
            </CardActionLink>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {plan.weekLoad.map(({ key, day, hours, level }) => {
              const hasLoad = hours > 0;
              return (
                <div
                  key={key}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border p-2.5',
                    hasLoad ? WORKLOAD_CHIP_CLASS[level] : 'border-border bg-accent/40',
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {forecastDayFormatter.format(day)}
                  </span>
                  <span className="text-lg font-bold text-foreground">{day.getDate()}</span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      hasLoad ? WORKLOAD_TEXT_CLASS[level] : 'text-muted-foreground',
                    )}
                  >
                    {hasLoad ? `${hours.toFixed(1)}h` : 'Free'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <SectionIcon icon="planner" />
              <h2 className="text-base font-semibold text-foreground">Planner Preview</h2>
            </div>
            <CardActionLink href="/planner" withChevron>
              Open planner
            </CardActionLink>
          </div>
          {plannerPreview.length === 0 ? (
            <EmptyState
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              }
              title="Nothing needs attention yet"
              description="Check the calendar for what's ahead."
            />
          ) : (
            <div className="divide-y divide-border">
              {plannerPreview.map(({ item, startDate, overloaded }) => {
                const course = courses.find((c) => c.id === item.courseId);
                const startsToday = startDate <= plan.weekLoad[0].key;
                return (
                  <TaskRow
                    key={item.id}
                    title={item.title}
                    href={'/tasks/' + item.id}
                    type={item.type}
                    courseCode={course ? course.code : 'General'}
                    courseColor={course?.color}
                    completed={item.completed}
                    priority={item.priority}
                    onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                    trailing={
                      overloaded ? (
                        <span className="rounded-full bg-load-critical/10 px-2 py-0.5 text-[10px] font-semibold text-load-critical">
                          Overloaded
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            startsToday
                              ? 'bg-load-high/10 text-load-high'
                              : 'bg-accent text-muted-foreground',
                          )}
                        >
                          {startsToday ? 'Start today' : 'This week'}
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>

        <Link href="/calendar" className="block">
          <Card hoverable className="flex items-center justify-center rounded-2xl p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]">
              View full calendar
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Card>
        </Link>
      </div>

      <CourseFormModal
        open={addCourseOpen}
        onClose={() => setAddCourseOpen(false)}
        onSubmit={handleAddCourse}
      />
      <TaskFormModal
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSubmit={handleAddTask}
        courses={courses}
      />
      <SyllabusAutofillModal open={autofillOpen} onClose={() => setAutofillOpen(false)} />
    </>
  );
}
