'use client';

import React, { useMemo, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import type { ScheduleItem, Priority, AssignmentType } from '@/types/schedule';

export type KanbanColumnId = 'backlog' | 'this_week' | 'in_progress' | 'done';

export interface KanbanColumnDef {
  id: KanbanColumnId;
  title: string;
  badgeColor: string;
  icon: string;
  description: string;
}

const COLUMNS: readonly KanbanColumnDef[] = [
  {
    id: 'backlog',
    title: 'Backlog & Later',
    badgeColor: 'bg-muted text-muted-foreground border-border/50',
    icon: '📋',
    description: 'Upcoming assignments and long-term milestones',
  },
  {
    id: 'this_week',
    title: 'Due This Week',
    badgeColor: 'bg-load-medium/15 text-load-medium border-load-medium/30',
    icon: '⚡',
    description: 'Deliverables due within the next 7 days',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    badgeColor: 'bg-primary/15 text-primary border-primary/30',
    icon: '🚀',
    description: 'Tasks actively being worked on right now',
  },
  {
    id: 'done',
    title: 'Completed',
    badgeColor: 'bg-load-low/15 text-load-low border-load-low/30',
    icon: '✓',
    description: 'Finished tasks and submitted assignments',
  },
] as const;

export interface TaskKanbanBoardProps {
  onSelectTask?: (task: ScheduleItem) => void;
  className?: string;
}

export function TaskKanbanBoard({ onSelectTask, className = '' }: TaskKanbanBoardProps) {
  const { state, dispatch } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<'all' | Priority>('all');
  const [customColumnOverrides, setCustomColumnOverrides] = useState<
    Record<string, KanbanColumnId>
  >({});

  // Filter tasks based on search, course, priority
  const filteredTasks = useMemo(() => {
    return state.scheduleItems.filter((item) => {
      if (selectedCourseFilter !== 'all' && item.courseId !== selectedCourseFilter) {
        return false;
      }
      if (selectedPriorityFilter !== 'all' && item.priority !== selectedPriorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesNotes) return false;
      }
      return true;
    });
  }, [state.scheduleItems, selectedCourseFilter, selectedPriorityFilter, searchQuery]);

  // Group tasks into 4 Kanban columns
  const columnTasks = useMemo(() => {
    const map: Record<KanbanColumnId, ScheduleItem[]> = {
      backlog: [],
      this_week: [],
      in_progress: [],
      done: [],
    };

    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    for (const item of filteredTasks) {
      // 1. Check custom user override first
      if (customColumnOverrides[item.id]) {
        map[customColumnOverrides[item.id]].push(item);
        continue;
      }

      // 2. Completed items go to done
      if (item.completed) {
        map.done.push(item);
        continue;
      }

      // 3. Check due date proximity
      if (item.dueDate) {
        const dueTime = new Date(item.dueDate).getTime();
        const diff = dueTime - now;
        if (diff > 0 && diff <= oneWeekMs) {
          map.this_week.push(item);
          continue;
        }
      }

      // 4. Default to backlog
      map.backlog.push(item);
    }

    return map;
  }, [filteredTasks, customColumnOverrides]);

  const handleMoveColumn = (taskId: string, targetCol: KanbanColumnId) => {
    setCustomColumnOverrides((prev) => ({
      ...prev,
      [taskId]: targetCol,
    }));

    // If moving to done, dispatch task update
    if (targetCol === 'done') {
      const task = state.scheduleItems.find((t) => t.id === taskId);
      if (task && !task.completed) {
        dispatch({
          type: 'UPDATE_SCHEDULE_ITEM',
          payload: { ...task, completed: true },
        });
      }
    } else {
      const task = state.scheduleItems.find((t) => t.id === taskId);
      if (task && task.completed) {
        dispatch({
          type: 'UPDATE_SCHEDULE_ITEM',
          payload: { ...task, completed: false },
        });
      }
    }
  };

  const handleToggleComplete = (task: ScheduleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !task.completed;
    dispatch({
      type: 'UPDATE_SCHEDULE_ITEM',
      payload: { ...task, completed: nextCompleted },
    });
    setCustomColumnOverrides((prev) => ({
      ...prev,
      [task.id]: nextCompleted ? 'done' : 'this_week',
    }));
  };

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return 'No due date';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getPriorityBadge = (priority?: Priority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="rounded bg-load-medium/15 px-1.5 py-0.5 text-[10px] font-bold text-load-medium">
            MED
          </span>
        );
      default:
        return (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            LOW
          </span>
        );
    }
  };

  const getTypeBadge = (type?: AssignmentType) => {
    const label = type ? type.toUpperCase() : 'TASK';
    return (
      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
        {label}
      </span>
    );
  };

  return (
    <div
      role="region"
      aria-label="Interactive Task Kanban Board"
      className={`space-y-4 ${className}`}
    >
      {/* Board Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-4 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, notes, or milestones..."
            aria-label="Search tasks in kanban"
            className="w-full rounded-xl border border-border bg-input px-3.5 py-2 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Course filter */}
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            aria-label="Filter kanban by course"
            className="rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="all">All Courses</option>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value as Priority | 'all')}
            aria-label="Filter kanban by priority"
            className="rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* 4 Kanban Columns Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4"
        role="region"
        aria-label="Kanban Columns"
      >
        {COLUMNS.map((col) => {
          const tasks = columnTasks[col.id];
          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-3 min-w-[280px] shadow-sm"
              role="list"
              aria-label={`${col.title} column`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{col.icon}</span>
                  <h3 className="text-xs font-bold text-foreground">{col.title}</h3>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${col.badgeColor}`}
                >
                  {tasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex-1 space-y-2.5 min-h-[140px]">
                {tasks.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No tasks in {col.title.toLowerCase()}
                    </p>
                  </div>
                ) : (
                  tasks.map((task) => {
                    const course = state.courses.find((c) => c.id === task.courseId);
                    return (
                      <div
                        key={task.id}
                        role="listitem"
                        onClick={() => onSelectTask?.(task)}
                        className={`group relative rounded-xl border border-border/60 bg-card p-3 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer ${
                          task.completed ? 'opacity-70 bg-muted/20' : ''
                        }`}
                      >
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {course && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                {course.code}
                              </span>
                            )}
                            {getTypeBadge(task.type)}
                          </div>
                          {getPriorityBadge(task.priority)}
                        </div>

                        {/* Title */}
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => handleToggleComplete(task, e)}
                            aria-label={`Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              task.completed
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border hover:border-primary'
                            }`}
                          >
                            {task.completed && (
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                          <h4
                            className={`text-xs font-semibold text-foreground leading-snug line-clamp-2 ${
                              task.completed ? 'line-through text-muted-foreground' : ''
                            }`}
                          >
                            {task.title}
                          </h4>
                        </div>

                        {/* Due Date & Column Move Handles */}
                        <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            📅 {formatDueDate(task.dueDate)}
                          </span>

                          {/* Quick Column Shift Buttons */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {col.id !== 'backlog' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const prevCol =
                                    col.id === 'done'
                                      ? 'in_progress'
                                      : col.id === 'in_progress'
                                        ? 'this_week'
                                        : 'backlog';
                                  handleMoveColumn(task.id, prevCol);
                                }}
                                title="Move Left"
                                aria-label={`Move ${task.title} left`}
                                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                ◀
                              </button>
                            )}
                            {col.id !== 'done' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextCol =
                                    col.id === 'backlog'
                                      ? 'this_week'
                                      : col.id === 'this_week'
                                        ? 'in_progress'
                                        : 'done';
                                  handleMoveColumn(task.id, nextCol);
                                }}
                                title="Move Right"
                                aria-label={`Move ${task.title} right`}
                                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                ▶
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TaskKanbanBoard;
