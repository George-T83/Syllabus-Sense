'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
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
import type { CourseFormValues } from '@/lib/validation/course';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

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

  if (!course) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          This course doesn&apos;t exist or has been removed.
        </p>
        <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
          ← Back to dashboard
        </Link>
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
        ...(values.instructor ? { instructor: values.instructor } : {}),
        ...(values.term ? { term: values.term } : {}),
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

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
        ← Back to dashboard
      </Link>

      <Card className="rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full shrink-0 ${course.color || 'bg-primary'}`} />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {course.code} · {course.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[course.instructor, course.term].filter(Boolean).join(' · ') || 'No details yet'}
              </p>
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setEditCourseOpen(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
            {confirmingDeleteCourse ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Delete course and its tasks?</span>
                <button
                  onClick={handleDeleteCourse}
                  className="font-semibold text-destructive hover:underline"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmingDeleteCourse(false)}
                  className="text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDeleteCourse(true)}
                className="text-xs font-semibold text-destructive hover:underline"
              >
                Delete
              </button>
            )}
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
          <button
            onClick={() => setAddTaskOpen(true)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Add Task
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks for this course yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleComplete(item)}
                  className="h-4 w-4 rounded border-border accent-primary shrink-0"
                  aria-label={`Mark ${item.title} complete`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium truncate ${
                      item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Due {dueDateFormatter.format(new Date(item.dueDate))}
                  </div>
                </div>
                <button
                  onClick={() => setEditingItem(item)}
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  Edit
                </button>
                {confirmingDeleteItemId === item.id ? (
                  <div className="flex items-center gap-2 text-xs shrink-0">
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
                    className="text-xs font-semibold text-destructive hover:underline shrink-0"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

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
    </div>
  );
}
