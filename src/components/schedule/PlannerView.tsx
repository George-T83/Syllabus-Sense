'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
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
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">All your tasks, across every course.</p>
      </div>

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
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks match these filters.</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredItems.map((item) => {
              const course = courses.find((c) => c.id === item.courseId);
              return (
                <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleComplete(item)}
                    className="h-4 w-4 rounded border-border accent-primary shrink-0"
                    aria-label={`Mark ${item.title} complete`}
                  />
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${course?.color || 'bg-primary'}`}
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
                      {course ? course.code : 'General'} · {TYPE_LABELS[item.type]}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    Due {dueDateFormatter.format(new Date(item.dueDate))}
                  </div>
                  <button
                    onClick={() => setEditingItem(item)}
                    className="text-xs font-semibold text-primary hover:underline shrink-0"
                  >
                    Edit
                  </button>
                  {confirmingDeleteId === item.id ? (
                    <div className="flex items-center gap-2 text-xs shrink-0">
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
                      className="text-xs font-semibold text-destructive hover:underline shrink-0"
                    >
                      Delete
                    </button>
                  )}
                </div>
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
