'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateScheduleItem, deleteScheduleItem } from '@/lib/firestore/scheduleItems';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem, AssignmentType } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

type StatusFilter = 'all' | 'pending' | 'completed';
type SortMode = 'dueDate' | 'priority';

const TYPE_LABELS: Record<AssignmentType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  project: 'Project',
  reading: 'Reading',
  other: 'Other',
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function isOverdue(item: ScheduleItem, today: Date): boolean {
  return !item.completed && new Date(item.dueDate) < today;
}

export function PlannerView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { courses, scheduleItems } = state;

  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AssignmentType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('dueDate');
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const pending = scheduleItems.filter((i) => !i.completed);
    const overdue = pending.filter((i) => isOverdue(i, today));
    return {
      pending: pending.length,
      overdue: overdue.length,
      completed: scheduleItems.length - pending.length,
    };
  }, [scheduleItems, today]);

  const filteredItems = useMemo(() => {
    let items = scheduleItems.slice();

    if (courseFilter !== 'all') items = items.filter((i) => i.courseId === courseFilter);
    if (typeFilter !== 'all') items = items.filter((i) => i.type === typeFilter);
    if (statusFilter === 'pending') items = items.filter((i) => !i.completed);
    if (statusFilter === 'completed') items = items.filter((i) => i.completed);

    items.sort((a, b) => {
      if (sortMode === 'priority') {
        const rankA = PRIORITY_RANK[a.priority ?? 'medium'];
        const rankB = PRIORITY_RANK[b.priority ?? 'medium'];
        if (rankA !== rankB) return rankA - rankB;
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return items;
  }, [scheduleItems, courseFilter, typeFilter, statusFilter, sortMode]);

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
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

  const handleDeleteTask = async (item: ScheduleItem) => {
    if (!user) return;
    await deleteScheduleItem(user.uid, item, dispatch);
    setConfirmingDeleteId(null);
  };

  const selectClass =
    'rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">All your tasks, across every course.</p>
      </div>

      {scheduleItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent/50 px-4 py-2.5 text-xs">
          <span className="font-semibold text-foreground">{stats.pending} pending</span>
          {stats.overdue > 0 && (
            <span className="flex items-center gap-1 font-semibold text-destructive">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {stats.overdue} overdue
            </span>
          )}
          <span className="text-muted-foreground">{stats.completed} completed</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">All Courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | AssignmentType)}
          className={selectClass}
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={selectClass}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className={selectClass}
        >
          <option value="dueDate">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
        </select>
      </div>

      <Card className="rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <SectionIcon icon="tasks" />
          <h2 className="text-base font-semibold text-foreground">
            {filteredItems.length} task{filteredItems.length === 1 ? '' : 's'}
          </h2>
        </div>

        {filteredItems.length === 0 ? (
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
            title="No tasks match these filters"
            description="Try widening your filters, or add a task from a course page."
          />
        ) : (
          <div className="divide-y divide-border">
            {filteredItems.map((item) => {
              const course = courses.find((c) => c.id === item.courseId);
              const overdue = isOverdue(item, today);
              return (
                <TaskRow
                  key={item.id}
                  title={item.title}
                  type={item.type}
                  courseCode={
                    course ? `${course.code} · ${TYPE_LABELS[item.type]}` : TYPE_LABELS[item.type]
                  }
                  courseColor={course?.color}
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
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Edit
                      </button>
                      {confirmingDeleteId === item.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            onClick={() => handleDeleteTask(item)}
                            className="font-semibold text-destructive hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="text-muted-foreground hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(item.id)}
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

      <TaskFormModal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditTask}
        courses={courses}
        initialItem={editingItem ?? undefined}
      />
    </div>
  );
}
