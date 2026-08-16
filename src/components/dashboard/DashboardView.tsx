'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { createCourse } from '@/lib/firestore/courses';
import { createScheduleItem } from '@/lib/firestore/scheduleItems';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import type { CourseFormValues } from '@/lib/validation/course';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function DashboardView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const { courses, scheduleItems } = state;
  const pendingTasks = scheduleItems.filter((item) => !item.completed);
  const completedTasksCount = scheduleItems.length - pendingTasks.length;
  const termProgressPct = scheduleItems.length
    ? Math.round((completedTasksCount / scheduleItems.length) * 100)
    : 0;

  const courseLoad = courses.map((course) => {
    const items = scheduleItems.filter((item) => item.courseId === course.id);
    const completed = items.filter((item) => item.completed).length;
    const pct = items.length ? Math.round((completed / items.length) * 100) : 0;
    return { course, pct };
  });

  const upcomingTasks = pendingTasks
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

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

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">{courses[0]?.term || 'No courses yet'}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex flex-row md:flex-col gap-3 md:w-40 shrink-0">
          <Card className="rounded-xl bg-primary/10 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-primary">{termProgressPct}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Term Progress</div>
          </Card>
          <Card className="rounded-xl bg-muted/60 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-foreground">{courses.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Courses</div>
          </Card>
          <Card className="rounded-xl bg-load-medium/10 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-load-medium">{pendingTasks.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
          </Card>
          <Card className="rounded-xl bg-load-low/10 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-load-low">{completedTasksCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Completed</div>
          </Card>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <Card className="rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Course Load</h2>
              <button
                onClick={() => setAddCourseOpen(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add Course
              </button>
            </div>

            {courseLoad.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No courses yet. Add one to start tracking your workload.
              </p>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Upcoming Tasks</h2>
              <button
                onClick={() => setAddTaskOpen(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add Task
              </button>
            </div>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing due. You&apos;re all caught up.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingTasks.map((item) => {
                  const course = courses.find((c) => c.id === item.courseId);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${course?.color || 'bg-primary'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {course ? course.code : 'General'}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        Due {dueDateFormatter.format(new Date(item.dueDate))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
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
    </div>
  );
}
