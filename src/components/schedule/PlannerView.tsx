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
import { courseSwatch } from '@/lib/courseColors';
import { clampProgress } from '@/lib/taskStatus';
import { cn } from '@/lib/utils';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem, AssignmentType, Priority } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

type StatusFilter = 'all' | 'pending' | 'completed';
/** What organizes the list into sections. 'date' buckets by due-date
 * proximity (Overdue/Today/This Week/Later - the Later bucket is further
 * split into month sub-headers, see monthSubGroups below), 'course' buckets
 * by class, 'status' buckets by Overdue/In Progress/Upcoming/Completed,
 * 'priority' buckets by High/Medium/Low, 'flat' renders one unsectioned
 * list (today's original behavior). */
type GroupBy = 'date' | 'course' | 'status' | 'priority' | 'flat';
/** Ordering applied within each group (and across the whole list when
 * groupBy is 'flat'). Exposed as its own control mainly so a course group
 * can be re-ordered by status instead of just due date. */
type WithinSort = 'dueDate' | 'priority' | 'status';

const TYPE_LABELS: Record<AssignmentType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  project: 'Project',
  reading: 'Reading',
  other: 'Other',
};

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  date: 'Due Date',
  course: 'Course',
  status: 'Status',
  priority: 'Priority',
  flat: 'Flat',
};

const WITHIN_SORT_LABELS: Record<WithinSort, string> = {
  dueDate: 'Due Date',
  priority: 'Priority',
  status: 'Status',
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function isOverdue(item: ScheduleItem, today: Date): boolean {
  return !item.completed && new Date(item.dueDate) < today;
}

/** Days between an item's due date and `today`, ignoring time of day, so
 * "Today"/"This Week" buckets don't depend on what hour it currently is. */
function dayDiff(dueDate: string, today: Date): number {
  const due = new Date(dueDate);
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
}

/** Overdue, then started-but-not-done, then not-yet-started, then completed
 * - the same four-way status split used for 'status' grouping, reused here
 * so 'Then by: Status' produces a consistent order whatever it's layered
 * onto (e.g. a course group sorted by status surfaces overdue and
 * in-progress work first, regardless of due date). */
function statusRank(item: ScheduleItem, today: Date): number {
  if (item.completed) return 3;
  if (isOverdue(item, today)) return 0;
  return clampProgress(item.progress ?? 0) > 0 ? 1 : 2;
}

function compareWithin(sort: WithinSort, a: ScheduleItem, b: ScheduleItem, today: Date): number {
  if (sort === 'priority') {
    const rankA = PRIORITY_RANK[a.priority ?? 'medium'];
    const rankB = PRIORITY_RANK[b.priority ?? 'medium'];
    if (rankA !== rankB) return rankA - rankB;
  } else if (sort === 'status') {
    const rankA = statusRank(a, today);
    const rankB = statusRank(b, today);
    if (rankA !== rankB) return rankA - rankB;
  }
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

interface ItemGroup {
  key: string;
  /** null renders no header at all (the 'flat' group). */
  label: string | null;
  courseColor?: string;
  dotClassName?: string;
  items: ScheduleItem[];
  /** Month sub-headers nested inside this group (TA-2). Used only for the
   * 'date' groupBy's Later bucket, which otherwise spans however many
   * months of due dates exist as one undifferentiated wall - a due-next-
   * week lab and a finals-week final would render as the exact same kind
   * of row. When present, the UI renders these instead of `items` flat. */
  monthSubGroups?: { key: string; label: string; items: ScheduleItem[] }[];
}

/** "September", or "September 2027" once the item's due date crosses into a
 * different year than today - so a Later bucket spanning a year boundary
 * (e.g. viewed in December) doesn't silently conflate next January with
 * this one. */
function monthSubGroupLabel(date: Date, today: Date): string {
  const sameYear = date.getFullYear() === today.getFullYear();
  const formatter = new Intl.DateTimeFormat(
    'en-US',
    sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' },
  );
  return formatter.format(date);
}

/** Chunks an already-sorted list of items into per-calendar-month buckets,
 * ordered chronologically by month regardless of the within-group sort
 * (priority/status sorts may otherwise interleave items across months). */
function groupByMonth(
  items: ScheduleItem[],
  today: Date,
): { key: string; label: string; items: ScheduleItem[] }[] {
  const byMonth = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const due = new Date(item.dueDate);
    const monthKey = `${due.getFullYear()}-${due.getMonth()}`;
    const list = byMonth.get(monthKey);
    if (list) list.push(item);
    else byMonth.set(monthKey, [item]);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => {
      const [aYear, aMonth] = a.split('-').map(Number);
      const [bYear, bMonth] = b.split('-').map(Number);
      return aYear !== bYear ? aYear - bYear : aMonth - bMonth;
    })
    .map(([monthKey, monthItems]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        key: monthKey,
        label: monthSubGroupLabel(new Date(year, month, 1), today),
        items: monthItems,
      };
    });
}

export function PlannerView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { courses, scheduleItems } = state;

  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AssignmentType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [withinSort, setWithinSort] = useState<WithinSort>('dueDate');
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

    return items;
  }, [scheduleItems, courseFilter, typeFilter, statusFilter]);

  const groups = useMemo<ItemGroup[]>(() => {
    const sortedWithin = (items: ScheduleItem[]) =>
      items.slice().sort((a, b) => compareWithin(withinSort, a, b, today));

    if (groupBy === 'flat') {
      return [{ key: 'flat', label: null, items: sortedWithin(filteredItems) }];
    }

    if (groupBy === 'course') {
      const byCourse = new Map<string, ScheduleItem[]>();
      for (const item of filteredItems) {
        const list = byCourse.get(item.courseId);
        if (list) list.push(item);
        else byCourse.set(item.courseId, [item]);
      }
      return Array.from(byCourse.entries())
        .map(([courseId, items]) => {
          const course = courses.find((c) => c.id === courseId);
          return {
            key: courseId,
            label: course ? course.code : 'General',
            courseColor: course?.color,
            items: sortedWithin(items),
          };
        })
        .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
    }

    if (groupBy === 'priority') {
      const buckets: Record<Priority, ScheduleItem[]> = { high: [], medium: [], low: [] };
      for (const item of filteredItems) {
        buckets[item.priority ?? 'medium'].push(item);
      }
      const order: { key: Priority; label: string; dot: string }[] = [
        { key: 'high', label: 'High Priority', dot: 'bg-destructive' },
        { key: 'medium', label: 'Medium Priority', dot: 'bg-load-medium' },
        { key: 'low', label: 'Low Priority', dot: 'bg-load-low' },
      ];
      return order
        .filter((g) => buckets[g.key].length > 0)
        .map((g) => ({
          key: g.key,
          label: g.label,
          dotClassName: g.dot,
          items: sortedWithin(buckets[g.key]),
        }));
    }

    if (groupBy === 'status') {
      const buckets: Record<'overdue' | 'inProgress' | 'upcoming' | 'completed', ScheduleItem[]> = {
        overdue: [],
        inProgress: [],
        upcoming: [],
        completed: [],
      };
      for (const item of filteredItems) {
        if (item.completed) buckets.completed.push(item);
        else if (isOverdue(item, today)) buckets.overdue.push(item);
        else if (clampProgress(item.progress ?? 0) > 0) buckets.inProgress.push(item);
        else buckets.upcoming.push(item);
      }
      const order: {
        key: 'overdue' | 'inProgress' | 'upcoming' | 'completed';
        label: string;
        dot: string;
      }[] = [
        { key: 'overdue', label: 'Overdue', dot: 'bg-destructive' },
        { key: 'inProgress', label: 'In Progress', dot: 'bg-primary' },
        { key: 'upcoming', label: 'Upcoming', dot: 'bg-muted-foreground' },
        { key: 'completed', label: 'Completed', dot: 'bg-load-low' },
      ];
      return order
        .filter((g) => buckets[g.key].length > 0)
        .map((g) => ({
          key: g.key,
          label: g.label,
          dotClassName: g.dot,
          items: sortedWithin(buckets[g.key]),
        }));
    }

    // date
    const buckets: Record<'overdue' | 'today' | 'week' | 'later' | 'completed', ScheduleItem[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
      completed: [],
    };
    for (const item of filteredItems) {
      if (item.completed) {
        buckets.completed.push(item);
        continue;
      }
      const diff = dayDiff(item.dueDate, today);
      if (diff < 0) buckets.overdue.push(item);
      else if (diff === 0) buckets.today.push(item);
      else if (diff < 7) buckets.week.push(item);
      else buckets.later.push(item);
    }
    const order: {
      key: 'overdue' | 'today' | 'week' | 'later' | 'completed';
      label: string;
      dot: string;
    }[] = [
      { key: 'overdue', label: 'Overdue', dot: 'bg-destructive' },
      { key: 'today', label: 'Today', dot: 'bg-primary' },
      { key: 'week', label: 'This Week', dot: 'bg-muted-foreground' },
      { key: 'later', label: 'Later', dot: 'bg-border' },
      { key: 'completed', label: 'Completed', dot: 'bg-load-low' },
    ];
    return order
      .filter((g) => buckets[g.key].length > 0)
      .map((g) => {
        const items = sortedWithin(buckets[g.key]);
        return {
          key: g.key,
          label: g.label,
          dotClassName: g.dot,
          items,
          // Later otherwise renders as one flat wall spanning however many
          // months out the syllabus goes - split it into month sub-headers
          // so it reads as a calendar-scale structure (TA-2).
          monthSubGroups: g.key === 'later' && items.length > 0 ? groupByMonth(items, today) : undefined,
        };
      });
  }, [filteredItems, groupBy, withinSort, today, courses]);

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
        ...(values.progress ? { progress: Number(values.progress) } : {}),
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

  // Factored out of the group-rendering loop so the same row (with its
  // trailing Overdue/Due/Edit/Delete controls) can be rendered both for a
  // group's flat item list and for each of a group's month sub-groups
  // (TA-2's Later-bucket split).
  const renderTaskRow = (item: ScheduleItem) => {
    const course = courses.find((c) => c.id === item.courseId);
    const overdue = isOverdue(item, today);
    const isConfirmingThisDelete = confirmingDeleteId === item.id;
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
        gradeWeight={item.gradeWeight}
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
            {/* Edit/Delete: de-emphasized (not full-strength) for a completed
             * task so finished work doesn't compete visually with
             * active/urgent rows - see TA-5. Full opacity while a delete
             * confirmation on THIS row is in flight, so that flow never
             * gets harder to see/tap mid-confirm. */}
            <span
              className={cn(
                'flex items-center gap-2',
                item.completed &&
                  !isConfirmingThisDelete &&
                  'opacity-50 transition-opacity hover:opacity-100 focus-within:opacity-100',
              )}
            >
              <button
                onClick={() => setEditingItem(item)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Edit
              </button>
              {isConfirmingThisDelete ? (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleDeleteTask(item)}
                    className="font-semibold text-foreground hover:underline"
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
                // Neutral/muted, not red - red is reserved for Overdue/
                // urgency badges (TA-5), so this common, low-stakes action
                // doesn't compete with the one badge that should stand out.
                <button
                  onClick={() => setConfirmingDeleteId(item.id)}
                  className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  Delete
                </button>
              )}
            </span>
          </>
        }
      />
    );
  };

  return (
    <>
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
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className={selectClass}
          >
            {Object.entries(GROUP_BY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                Group: {label}
              </option>
            ))}
          </select>

          <select
            value={withinSort}
            onChange={(e) => setWithinSort(e.target.value as WithinSort)}
            className={selectClass}
          >
            {Object.entries(WITHIN_SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                Then by: {label}
              </option>
            ))}
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
            <div className="space-y-5">
              {groups.map((group) => {
                const swatch = group.courseColor ? courseSwatch(group.courseColor) : null;
                return (
                  <div key={group.key}>
                    {group.label && (
                      <div className="mb-1.5 flex items-baseline gap-2 px-1">
                        {swatch ? (
                          <span
                            className={cn('h-2 w-2 shrink-0 rounded-full', swatch.className)}
                            style={swatch.style}
                          />
                        ) : (
                          group.dotClassName && (
                            <span
                              className={cn('h-2 w-2 shrink-0 rounded-full', group.dotClassName)}
                            />
                          )
                        )}
                        <h3 className="text-xs font-semibold text-foreground">{group.label}</h3>
                        <span className="text-[11px] text-muted-foreground">
                          {group.items.length}
                        </span>
                      </div>
                    )}
                    {group.monthSubGroups ? (
                      <div className="space-y-4">
                        {group.monthSubGroups.map((sub) => (
                          <div key={sub.key}>
                            <h4 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {sub.label}
                            </h4>
                            <div className="flex flex-col gap-2">{sub.items.map(renderTaskRow)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">{group.items.map(renderTaskRow)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <TaskFormModal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditTask}
        courses={courses}
        initialItem={editingItem ?? undefined}
      />
    </>
  );
}
