'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { TaskRow } from '@/components/ui/TaskRow';
import { useToast } from '@/components/ui/Toast';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import {
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '@/lib/firestore/scheduleItems';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { courseSwatch } from '@/lib/courseColors';
import { clampProgress } from '@/lib/taskStatus';
import { cn } from '@/lib/utils';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem, AssignmentType, Priority, Course } from '@/types/schedule';
import {
  SHORT_DATE_FORMATTER as dueDateFormatter,
  MONTH_LONG_FORMATTER,
  MONTH_YEAR_FORMATTER,
} from '@/lib/dateFormatters';
import {
  computeSmartPlan,
  getLocalReferenceDate,
  type PlannedItem,
} from '@/lib/planner/computeSmartPlan';
import {
  getWorkloadLevel,
  WORKLOAD_LEVEL_LABELS,
  WORKLOAD_CHIP_CLASS,
  WORKLOAD_TEXT_CLASS,
  WORKLOAD_BADGE_CLASS,
  toDateOnly,
} from '@/lib/workload';

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
  return dueInstant(a.dueDate).getTime() - dueInstant(b.dueDate).getTime();
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
  return (sameYear ? MONTH_LONG_FORMATTER : MONTH_YEAR_FORMATTER).format(date);
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
    const due = parseDayKey(item.dueDate);
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

import { WorkloadOverviewDashboard } from '@/components/planner/WorkloadOverviewDashboard';
import { SemesterHeatmapCard } from '@/components/planner/SemesterHeatmapCard';
import { StudyBlockSuggestionsCard } from '@/components/planner/StudyBlockSuggestionsCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPageGuide } from '@/components/ui/EmptyPageGuide';
import { CardActionButton, CardActionLink, SyllabusIcon } from '@/components/ui/CardAction';
import { SyllabusAutofillModal } from '@/components/syllabus/SyllabusAutofillModal';
import { daysUntilDue, dueInstant, isOverdue, parseDayKey } from '@/lib/calendar/dates';

/** Default number of task rows a group shows before collapsing the rest
 * behind a "Show N more" toggle. A real semester's task list can run into
 * the hundreds of items once rollover/overdue tasks accumulate - rendering
 * every group in full made this page endless to scroll. Capping each group
 * (and each Later-bucket month sub-group) independently keeps it skimmable
 * while every item stays reachable in one click. */
const DEFAULT_VISIBLE_COUNT = 8;

/** Renders `items` (via `renderItem`) capped to `initialCount`, with a
 * "Show N more" / "Show less" toggle when there's more than that to show.
 * Each call site gets its own independent expand/collapse state. Generic
 * over the item type so it serves both the plain ScheduleItem groups below
 * and the PlannedItem-wrapped rows (recommended start date, overload/tight
 * flags) merged in from the former standalone Planner page. */
function ExpandableItemList<T>({
  items,
  renderItem,
  initialCount = DEFAULT_VISIBLE_COUNT,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  const remaining = items.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      {visible.map(renderItem)}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 min-h-[44px] self-start rounded-lg px-2 text-xs font-semibold text-primary hover:underline"
        >
          Show {remaining} more
        </button>
      )}
      {expanded && items.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="min-h-[44px] self-start rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}

/**
 * Formats a `YYYY-MM-DD` planning key (`PlannedItem.startDate`, always a
 * UTC-normalized date-only string - see lib/workload/dateUtils.ts) as local
 * calendar text. Goes through `toDateOnly` and reads UTC getters back into a
 * *local* Date's Y/M/D components rather than formatting the UTC-midnight
 * Date directly, so a negative-UTC-offset viewer's Intl formatter can't roll
 * it back a day.
 */
function formatPlanDateKey(dateKey: string): string {
  const d = toDateOnly(dateKey);
  return dueDateFormatter.format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function PlannedTaskRow({
  item,
  startDate,
  course,
  overloaded,
  tight,
  overdue,
  onToggleComplete,
  variant,
}: {
  item: PlannedItem['item'];
  startDate: string;
  course: Course | undefined;
  overloaded: boolean;
  tight: boolean;
  overdue: boolean;
  onToggleComplete?: () => void;
  variant?: 'card' | 'touch';
}) {
  const dueLabel = dueDateFormatter.format(parseDayKey(item.dueDate));
  const startLabel = formatPlanDateKey(startDate);
  return (
    <TaskRow
      variant={variant}
      title={item.title}
      href={`/tasks/${item.id}`}
      type={item.type}
      courseCode={course ? course.code : 'General'}
      courseColor={course?.color}
      courseIcon={course?.icon}
      completed={item.completed}
      progress={item.progress}
      priority={item.priority}
      assignedTo={item.assignedTo}
      onToggleComplete={onToggleComplete}
      // Stacked (not side-by-side) so the trailing block's natural width is
      // the widest SINGLE line, not badge+gap+date combined. Prints the
      // recommended start date alongside the due date.
      trailing={
        <div className="flex flex-col items-end gap-1 text-right">
          {overdue ? (
            <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              Overdue
            </span>
          ) : overloaded ? (
            <span
              className={cn(
                'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold',
                WORKLOAD_BADGE_CLASS.critical,
              )}
            >
              Runway Exhausted
            </span>
          ) : (
            tight && (
              <span className="whitespace-nowrap rounded-full bg-load-high/10 px-2 py-0.5 text-[10px] font-semibold text-load-high">
                Tight
              </span>
            )
          )}
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            Start {startLabel}
          </span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">Due {dueLabel}</span>
        </div>
      }
    />
  );
}

function PlanSection({
  title,
  items,
  courses,
  variant,
  onToggleComplete,
}: {
  title: string;
  items: PlannedItem[];
  courses: Course[];
  variant?: 'card' | 'touch';
  onToggleComplete?: (item: ScheduleItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="rounded-2xl p-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <ExpandableItemList
        items={items}
        renderItem={({ item, startDate, overloaded, tight, overdue }) => (
          <PlannedTaskRow
            key={item.id}
            item={item}
            startDate={startDate}
            course={courses.find((c) => c.id === item.courseId)}
            overloaded={overloaded}
            tight={tight}
            overdue={overdue}
            variant={variant}
            onToggleComplete={onToggleComplete ? () => onToggleComplete(item) : undefined}
          />
        )}
      />
    </Card>
  );
}

export function PlannerView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { courses, scheduleItems } = state;

  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AssignmentType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [withinSort, setWithinSort] = useState<WithinSort>('dueDate');
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);

  const today = useMemo(() => new Date(), []);

  // Merged in from the former standalone /planner page: a recommended-
  // start-date plan (distinct from the due-date groups below - a task can
  // be due Friday but recommended to start Tuesday once earlier days are
  // already full).
  const referenceDate = useMemo(() => getLocalReferenceDate(), []);
  const plan = useMemo(
    () => computeSmartPlan(scheduleItems, referenceDate),
    [scheduleItems, referenceDate],
  );
  const todayLoad = plan.weekLoad[0];
  const todayLevel = getWorkloadLevel(todayLoad.hours);
  const hasOverdueBacklog = plan.overdueHours > 1e-9;

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
      const diff = daysUntilDue(item.dueDate, today);
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
          monthSubGroups:
            g.key === 'later' && items.length > 0 ? groupByMonth(items, today) : undefined,
        };
      });
  }, [filteredItems, groupBy, withinSort, today, courses]);

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    try {
      await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      showError("Couldn't update that task. Try again in a moment.");
    }
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
        ...(values.gradeWeight ? { gradeWeight: Number(values.gradeWeight) } : {}),
        ...(values.gradeCategory ? { gradeCategory: values.gradeCategory } : {}),
        ...(values.assignedTo ? { assignedTo: values.assignedTo } : {}),
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
        ...(values.gradeWeight ? { gradeWeight: Number(values.gradeWeight) } : {}),
        ...(values.gradeCategory ? { gradeCategory: values.gradeCategory } : {}),
        ...(values.assignedTo ? { assignedTo: values.assignedTo } : {}),
      },
      dispatch,
    );
  };

  const handleDeleteTask = async (item: ScheduleItem) => {
    if (!user) return;
    try {
      await deleteScheduleItem(user.uid, item, dispatch);
      setConfirmingDeleteId(null);
      showSuccess('Task deleted', `"${item.title}" was removed.`);
    } catch (err) {
      showError('Could not delete task', err instanceof Error ? err.message : undefined);
    }
  };

  const selectClass =
    'rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]';

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
        assignedTo={item.assignedTo}
        onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
        trailing={
          <>
            {overdue && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                Overdue
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Due {dueDateFormatter.format(parseDayKey(item.dueDate))}
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
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Edit
              </button>
              {isConfirmingThisDelete ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => handleDeleteTask(item)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-foreground/10 px-2.5 font-semibold text-foreground transition-colors hover:bg-foreground/15"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(null)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full px-2.5 text-muted-foreground transition-colors hover:bg-accent"
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
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

  // Nothing to plan yet: every card below would render at zero ("0.0h due
  // today", seven "LIGHT" days, empty study blocks), so the page says what
  // it will do and how to fill it instead.
  if (state.initialized && scheduleItems.length === 0) {
    const noCourses = courses.length === 0;
    return (
      <>
        <div className="max-w-5xl space-y-6 sm:space-y-8">
          <PageHeader
            eyebrow="Coursework"
            title="Tasks"
            description="Everything due, across every course - plus what to start when."
          />
          <EmptyPageGuide
            title={noCourses ? 'Start with a course' : 'Your deadlines go here'}
            lead={
              noCourses
                ? "Tasks belong to a course. Upload a syllabus and we'll set up the course and every deadline in it, or add a course first and fill in its work by hand."
                : 'Add your assignments, quizzes and exams, and this page works out how much to do each day and when to start each one.'
            }
            actions={
              <>
                <CardActionButton variant="primary" onClick={() => setAutofillOpen(true)}>
                  <SyllabusIcon />
                  Upload a syllabus
                </CardActionButton>
                {noCourses ? (
                  <CardActionLink href="/courses" withChevron>
                    Add a course
                  </CardActionLink>
                ) : (
                  <CardActionButton withPlus onClick={() => setAddTaskOpen(true)}>
                    Add a task
                  </CardActionButton>
                )}
              </>
            }
            previews={[
              {
                icon: <SectionIcon icon="tasks" />,
                title: "Today's load",
                detail:
                  'The hours to put in today across every course, weighted by how big each piece of work is.',
              },
              {
                icon: <SectionIcon icon="planner" />,
                title: 'What to start when',
                detail:
                  "Each deadline gets a start date from its size, so a 10-hour project doesn't sneak up on you.",
              },
              {
                icon: <SectionIcon icon="calendar" />,
                title: 'Study blocks',
                detail:
                  'Concrete times to work, fitted around your classes and the rest of your week.',
              },
            ]}
          />
        </div>
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

  return (
    <>
      <div className="max-w-5xl space-y-6 sm:space-y-8">
        <PageHeader
          eyebrow="Coursework"
          title="Tasks"
          description="Everything due, across every course - plus what to start when."
          actions={
            scheduleItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {stats.pending} pending
                </span>
                {stats.overdue > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-load-critical/30 bg-load-critical/10 px-3 py-1 text-xs font-semibold text-load-critical">
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
                <span className="rounded-full border border-load-low/30 bg-load-low/10 px-3 py-1 text-xs font-semibold text-load-low">
                  {stats.completed} completed
                </span>
              </div>
            ) : undefined
          }
        />

        {/* Hero: today's recommended-start load is the single most useful
            glanceable fact on this page - merged in from the former
            standalone Planner page rather than buried in the 7-day strip
            alongside every other day. */}
        <Card accent className="rounded-2xl p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Today&apos;s Load
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {plan.runwayExhaustedCount > 0 && (
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-caption font-semibold',
                    WORKLOAD_BADGE_CLASS.critical,
                  )}
                >
                  {plan.runwayExhaustedCount} Runway Exhausted
                </span>
              )}
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-caption font-semibold',
                  WORKLOAD_CHIP_CLASS[todayLevel],
                  WORKLOAD_TEXT_CLASS[todayLevel],
                )}
              >
                {WORKLOAD_LEVEL_LABELS[todayLevel]}
              </span>
            </div>
          </div>
          <div className="mb-1 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex items-end gap-2">
              <span className="text-display text-foreground sm:text-5xl">
                {todayLoad.hours.toFixed(1)}
                <span className="ml-1 text-h3 text-muted-foreground sm:text-xl">h</span>
              </span>
              <span className="pb-1.5 text-body-sm text-muted-foreground">due today</span>
            </div>
            {hasOverdueBacklog && (
              <div className="flex items-end gap-2">
                <span className="text-h1 text-destructive sm:text-3xl">
                  {plan.overdueHours.toFixed(1)}
                  <span className="ml-1 text-body-sm font-semibold text-destructive/70 sm:text-base">
                    h
                  </span>
                </span>
                <span className="pb-1 text-body-sm text-muted-foreground">overdue backlog</span>
              </div>
            )}
          </div>
          <p className="mb-5 text-xs text-muted-foreground">
            Calculated from your exams, projects, and readings - weighted by type and progress, not
            just a headcount.
          </p>

          {plan.startToday.length === 0 ? (
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
              title="Nothing to start today"
              description="You're caught up - check back tomorrow."
            />
          ) : (
            <ExpandableItemList
              items={plan.startToday}
              renderItem={({ item, startDate, overloaded, tight, overdue }) => (
                <PlannedTaskRow
                  key={item.id}
                  variant={state.preferences.taskRowVariant}
                  item={item}
                  startDate={startDate}
                  course={courses.find((c) => c.id === item.courseId)}
                  overloaded={overloaded}
                  tight={tight}
                  overdue={overdue}
                  onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                />
              )}
            />
          )}
        </Card>

        {plan.overdueItems.length > 0 && (
          <Card
            accent="none"
            className="rounded-2xl border-destructive/30 bg-destructive/5 p-4 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">
                  !
                </span>
                <h2 className="text-sm font-semibold text-destructive">
                  Overdue Backlog ({plan.overdueItems.length}{' '}
                  {plan.overdueItems.length === 1 ? 'item' : 'items'})
                </h2>
              </div>
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                {plan.overdueHours.toFixed(1)}h backlog debt
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Past-due deliverables are separated from prospective 7-day runway planning. Complete
              or reschedule these items to clear debt.
            </p>
            <ExpandableItemList
              items={plan.overdueItems}
              renderItem={({ item, startDate, overloaded, tight, overdue }) => (
                <PlannedTaskRow
                  key={item.id}
                  item={item}
                  startDate={startDate}
                  course={courses.find((c) => c.id === item.courseId)}
                  overloaded={overloaded}
                  tight={tight}
                  overdue={overdue}
                  variant={state.preferences.taskRowVariant}
                  onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                />
              )}
            />
          </Card>
        )}

        <WorkloadOverviewDashboard />

        <SemesterHeatmapCard />

        <StudyBlockSuggestionsCard />

        <PlanSection
          title="Start This Week"
          items={plan.startThisWeek}
          courses={courses}
          variant={state.preferences.taskRowVariant}
          onToggleComplete={user ? handleToggleComplete : undefined}
        />
        <PlanSection
          title="Later"
          items={plan.startLater}
          courses={courses}
          variant={state.preferences.taskRowVariant}
          onToggleComplete={user ? handleToggleComplete : undefined}
        />

        {/* Header, stats, and filters as one panel (matching the Card
         * language WorkloadOverviewDashboard already establishes above)
         * instead of a bare heading + a plain text stats strip + a loose
         * row of selects each doing their own thing. */}
        <Card className="rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by course"
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
              aria-label="Filter by type"
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
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={selectClass}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>

            {/* Group-by/sort-by are a conceptually distinct pair (how the
             * list is organized, not what's included in it) from the three
             * inclusion filters above - the divider reads that split at a
             * glance instead of five identical-looking selects in a row. */}
            <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

            <select
              aria-label="Group by"
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
              aria-label="Then sort by"
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
        </Card>

        <Card className="rounded-2xl p-6" data-testid="tasks-list-card">
          <div className="mb-4 flex items-center gap-3">
            <SectionIcon icon="tasks" />
            <h2 className="text-base font-semibold text-foreground">
              {filteredItems.length} task{filteredItems.length === 1 ? '' : 's'}
            </h2>
          </div>

          {!state.initialized ? (
            // See the identical guard in CoursesListView.tsx - without it, a
            // student with real tasks briefly sees "No tasks match these
            // filters" before the first Firestore snapshot lands.
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredItems.length === 0 ? (
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
                            <ExpandableItemList items={sub.items} renderItem={renderTaskRow} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ExpandableItemList items={group.items} renderItem={renderTaskRow} />
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
