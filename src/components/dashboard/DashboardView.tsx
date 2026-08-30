'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
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
import { courseChipTint, courseSwatch } from '@/lib/courseColors';
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

/**
 * DA-5: a plain, low-emphasis "view more" navigation link - deliberately
 * lighter than CardActionLink's bordered-pill `ghost` styling, so secondary
 * navigation ("View all", "Open planner") doesn't visually compete with the
 * real actions on the dashboard (the Autofill banner, "+ Add Task"/"+ Add
 * Course"). Local to this file rather than a CardAction variant change,
 * since CardActionLink's current look is still correct elsewhere it's used.
 */
function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      {children}
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export function DashboardView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);

  const { courses, scheduleItems } = state;

  const currentTerm = useMemo(
    () => resolveActiveTerm(state.selectedTerm, courses),
    [state.selectedTerm, courses],
  );
  const semesterCourses = currentTerm ? courses.filter((c) => c.term === currentTerm) : courses;
  // All the stats below need to respect the selected term too, not just the
  // Course Load card - previously they always used the full, unfiltered
  // scheduleItems, so switching the term dropdown left the progress ring,
  // pending/done counts, and Upcoming Tasks showing every term's data at once.
  const semesterCourseIds = useMemo(
    () => new Set(semesterCourses.map((c) => c.id)),
    [semesterCourses],
  );
  const termScheduleItems = useMemo(
    () => scheduleItems.filter((item) => semesterCourseIds.has(item.courseId)),
    [scheduleItems, semesterCourseIds],
  );

  const pendingTasks = termScheduleItems.filter((item) => !item.completed);
  const completedTasksCount = termScheduleItems.length - pendingTasks.length;
  const termProgressPct = termScheduleItems.length
    ? Math.round((completedTasksCount / termScheduleItems.length) * 100)
    : 0;
  const now = useMemo(() => Date.now(), []);
  const overdueCount = pendingTasks.filter((item) => new Date(item.dueDate).getTime() < now).length;

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
    () => computeSmartPlan(termScheduleItems, referenceDate),
    [termScheduleItems, referenceDate],
  );
  // DA-2: Planner Preview used to show the same due-soonest items as
  // Upcoming Tasks (identical rows, contradicting badges - "Overdue" vs
  // "Overloaded" - seconds apart). Excluding whatever Upcoming Tasks
  // already surfaced means Planner Preview only ever shows genuinely
  // different information: what the workload-aware planner recommends
  // starting soon that isn't already covered by the plain due-date list.
  const upcomingTaskIds = useMemo(() => new Set(upcomingTasks.map((t) => t.id)), [upcomingTasks]);
  const plannerPreview = [...plan.startToday, ...plan.startThisWeek]
    .filter((p) => !upcomingTaskIds.has(p.item.id))
    .slice(0, 4);

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
        icon: values.icon,
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
          <h1 className="text-display text-foreground">
            {greeting}, <span className="text-gradient-brand">{firstName}</span>
          </h1>
          <p className="mt-1.5 text-body-sm text-muted-foreground">
            {currentTerm || courses[0]?.term || 'No courses yet'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-6 text-white shadow-card">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-h3 text-white font-bold">
                Got a syllabus? Let Claude set it up.
              </h2>
              <p className="mt-1 text-body-sm text-white/80">
                Upload the PDF or Word doc and get a course plus every assignment drafted for you to
                review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutofillOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-label text-primary shadow-sm transition-transform hover:scale-[1.02]"
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

        <div className="space-y-4">
          <Card accent="left" className="rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-3">
                  <SectionIcon icon="tasks" />
                  <h2 className="text-h2 text-foreground">Upcoming Tasks</h2>
                </div>
                {overdueCount > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption text-destructive">
                    {overdueCount} overdue
                  </span>
                )}
                {completedTasksCount > 0 && (
                  <span className="rounded-full bg-load-low/10 px-2 py-0.5 text-caption text-load-low">
                    {completedTasksCount} completed this term
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <QuietLink href="/tasks">View all</QuietLink>
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={courses.length === 0 ? 'M12 4.5v15m7.5-7.5h-15' : 'M5 13l4 4L19 7'}
                    />
                  </svg>
                }
                title={courses.length === 0 ? 'Add your first course' : 'Nothing due'}
                description={
                  courses.length === 0
                    ? 'Get started by adding a course or two.'
                    : "You're all caught up."
                }
                action={
                  courses.length === 0
                    ? { label: '+ Add Course', onClick: () => setAddCourseOpen(true) }
                    : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingTasks.map((item) => {
                  const course = courses.find((c) => c.id === item.courseId);
                  const overdue = !item.completed && new Date(item.dueDate).getTime() < now;
                  return (
                    <TaskRow
                      key={item.id}
                      variant={state.preferences.taskRowVariant}
                      title={item.title}
                      href={'/tasks/' + item.id}
                      type={item.type}
                      courseCode={course ? course.code : 'General'}
                      courseColor={course?.color}
                      courseIcon={course?.icon}
                      completed={item.completed}
                      progress={item.progress}
                      priority={item.priority}
                      onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                      trailing={
                        // DA-1: stacked (badge above date) rather than
                        // side-by-side - side-by-side was the widest
                        // non-shrinking part of the row, the main reason due
                        // dates got pushed off-screen on a real phone.
                        // Stacking keeps the same information at roughly
                        // half the horizontal footprint.
                        <div className="flex flex-col items-end gap-0.5">
                          {overdue && (
                            <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              Overdue
                            </span>
                          )}
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {dueDateFormatter.format(new Date(item.dueDate))}
                          </span>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <SectionIcon icon="courseLoad" className="h-6 w-6" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">Course Load</h2>
                    {currentTerm && <p className="text-xs text-muted-foreground">{currentTerm}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <QuietLink href="/courses">View all</QuietLink>
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
                <div className="space-y-2">
                  {courseLoad.map(({ course, pct }) => {
                    const tint = courseChipTint(course.color);
                    const swatch = courseSwatch(course.color);
                    return (
                      <Link
                        key={course.id}
                        href={`/courses/${course.id}`}
                        className={cn(
                          'block rounded-xl border p-3 transition-colors hover:brightness-95',
                          tint.className,
                        )}
                        style={tint.style}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-semibold">
                            {course.code} · {course.title}
                          </span>
                          <span className="shrink-0 font-semibold">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                          <div
                            className={cn('h-full rounded-full', swatch.className)}
                            style={{ width: `${pct}%`, ...swatch.style }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* DA-4/MO-5: `self-start` stops this card stretching to match
                Course Load's height in the sm:grid-cols-2 row (the default
                grid stretch left ~300-400px of dead space at both desktop
                and tablet widths) - it now sizes to its own content. */}
            <Card className="rounded-2xl p-4 self-start">
              <div className="mb-3 flex items-center gap-2.5">
                <SectionIcon icon="star" className="h-6 w-6" />
                <h2 className="text-sm font-semibold text-foreground">Term Progress</h2>
              </div>
              {courses.length === 0 ? (
                // MO-4: a brand-new account with zero courses/zero everything
                // used to render this same ring-at-0%-plus-zeros grid, which
                // reads as "something failed to load" rather than "welcome".
                // A distinct onboarding message replaces it instead.
                <div className="flex flex-col items-start gap-2 py-1">
                  <p className="text-sm font-semibold text-foreground">Welcome aboard</p>
                  <p className="text-xs text-muted-foreground">
                    Add your first course to start tracking assignments and workload.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAddCourseOpen(true)}
                    className="mt-1 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    + Add Course
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ProgressRing percent={termProgressPct} size={80} strokeWidth={7}>
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground">{termProgressPct}%</div>
                    </div>
                  </ProgressRing>
                  <div className="grid flex-1 grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-base font-bold text-primary">
                        {semesterCourses.length}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Courses</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-load-medium">
                        {pendingTasks.length}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Pending</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-load-low">{completedTasksCount}</div>
                      <div className="text-[10px] text-muted-foreground">Done</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        <Card className="rounded-2xl p-4 sm:p-6">
          {/* DA-5: this card used to duplicate Planner Preview's "Open
              planner" link below - two links to the same destination on
              one screen. Planner Preview's is the more specific one (it
              links from actual recommended items), so it's the one kept;
              this header is now just a label. */}
          <div className="mb-4 flex items-center gap-3">
            <SectionIcon icon="forecast" />
            <h2 className="text-base font-semibold text-foreground">7-Day Load</h2>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {plan.weekLoad.map(({ key, day, hours, level }) => {
              const hasLoad = hours > 0;
              return (
                <div
                  key={key}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border p-1 sm:gap-1 sm:rounded-xl sm:p-2.5',
                    hasLoad ? WORKLOAD_CHIP_CLASS[level] : 'border-border bg-accent/40',
                  )}
                >
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    {forecastDayFormatter.format(day)}
                  </span>
                  <span className="text-sm font-bold text-foreground sm:text-lg">
                    {day.getDate()}
                  </span>
                  <span
                    className={cn(
                      'text-[8px] font-semibold sm:text-[10px]',
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
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
            <div className="flex items-center gap-3">
              <SectionIcon icon="planner" />
              <h2 className="text-base font-semibold text-foreground">Planner Preview</h2>
            </div>
            <QuietLink href="/planner">Open planner</QuietLink>
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
            <div className="flex flex-col gap-2">
              {plannerPreview.map(({ item, startDate, overloaded }) => {
                const course = courses.find((c) => c.id === item.courseId);
                const startsToday = startDate <= plan.weekLoad[0].key;
                return (
                  <TaskRow
                    key={item.id}
                    variant={state.preferences.taskRowVariant}
                    title={item.title}
                    href={'/tasks/' + item.id}
                    type={item.type}
                    courseCode={course ? course.code : 'General'}
                    courseColor={course?.color}
                    courseIcon={course?.icon}
                    completed={item.completed}
                    progress={item.progress}
                    priority={item.priority}
                    onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                    trailing={
                      overloaded ? (
                        // VA-5: "Overloaded" read as alarm-only red - the
                        // same hue as a destructive/error state - with no
                        // suggested next step. "Tight" + an action (start
                        // today) reads as a coach's nudge instead of a
                        // warning, and load-high (amber) instead of
                        // load-critical (red) keeps it out of destructive-
                        // red territory entirely.
                        <span className="rounded-full bg-load-high/10 px-2 py-0.5 text-[10px] font-semibold text-load-high">
                          Tight · start today
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
