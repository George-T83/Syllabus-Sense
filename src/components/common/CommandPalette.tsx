'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/context/AppStateContext';
import { useTheme } from '@/context/ThemeProvider';
import { usePlatformKey } from '@/hooks/usePlatformKey';
import { isCardDue } from '@/lib/flashcards/sm2';

export interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onAction?: (actionId: string) => void;
}

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Courses' | 'Tasks' | 'Actions';
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'urgent' | 'primary' | 'muted';
  perform: () => void;
}

export function CommandPalette({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onOpen: controlledOnOpen,
  onAction,
}: CommandPaletteProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === 'boolean';
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<
    'All' | 'Navigation' | 'Courses' | 'Tasks' | 'Actions'
  >('All');

  const { state } = useAppState();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const modKey = usePlatformKey();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    if (isControlled) {
      controlledOnOpen?.();
    } else {
      setInternalIsOpen(true);
    }
  }, [isControlled, controlledOnOpen]);

  const closePalette = useCallback(() => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalIsOpen(false);
    }
    setQuery('');
    setSelectedIndex(0);
  }, [isControlled, controlledOnClose]);

  // Global hotkey: Cmd+P / Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (isOpen) {
          closePalette();
        } else {
          openPalette();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closePalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openPalette, closePalette]);

  // Focus trap & autofocus
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Command items builder
  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Navigation
      {
        id: 'nav-dashboard',
        title: 'Dashboard',
        subtitle: "Overview, today's runway, and cognitive load",
        category: 'Navigation',
        badge: 'Home',
        perform: () => {
          router.push('/');
          closePalette();
        },
      },
      {
        id: 'nav-courses',
        title: 'Courses',
        subtitle: 'All enrolled courses, syllabi, and details',
        category: 'Navigation',
        badge: `${state.courses.length}`,
        perform: () => {
          router.push('/courses');
          closePalette();
        },
      },
      {
        id: 'nav-tasks',
        title: 'Tasks & Planner',
        subtitle: 'Assignments, deliverables, and workload planner',
        category: 'Navigation',
        badge: `${state.scheduleItems.filter((t) => !t.completed).length} pending`,
        perform: () => {
          router.push('/tasks');
          closePalette();
        },
      },
      {
        id: 'nav-flashcards',
        title: 'Flashcards',
        subtitle: 'AI-generated study decks with spaced-repetition review',
        category: 'Navigation',
        badge: `${state.flashcards.filter((c) => isCardDue(c)).length} due`,
        perform: () => {
          router.push('/flashcards');
          closePalette();
        },
      },
      {
        id: 'nav-calendar',
        title: 'Calendar',
        subtitle: 'Month & week views, class schedules, and deadlines',
        category: 'Navigation',
        perform: () => {
          router.push('/calendar');
          closePalette();
        },
      },
      {
        id: 'nav-contacts',
        title: 'Contacts & Office Hours',
        subtitle: 'Instructors, TAs, office hours, and study groups',
        category: 'Navigation',
        badge: `${state.contacts.length}`,
        perform: () => {
          router.push('/contacts');
          closePalette();
        },
      },
      {
        id: 'nav-profile',
        title: 'Profile & Preferences',
        subtitle: 'Account settings, notification toggles, and appearance',
        category: 'Navigation',
        perform: () => {
          router.push('/profile');
          closePalette();
        },
      },
      {
        id: 'nav-upload',
        title: 'Upload Syllabus',
        subtitle: 'Import PDF / DOCX syllabus with AI auto-extraction',
        category: 'Navigation',
        badge: 'AI',
        badgeVariant: 'primary',
        perform: () => {
          // There is no dedicated /syllabus route - "Autofill from Syllabus"
          // lives on the Courses page. This previously 404'd.
          router.push('/courses?autofill=true');
          closePalette();
        },
      },

      // Quick Actions
      {
        id: 'action-theme-toggle',
        title: resolvedTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: `Currently using ${resolvedTheme || 'system'} theme`,
        category: 'Actions',
        badge: resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode',
        perform: () => {
          setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
          onAction?.('theme-toggle');
          closePalette();
        },
      },
      {
        id: 'action-new-task',
        title: 'Add New Task / Assignment',
        subtitle: 'Create a custom deadline or deliverable',
        category: 'Actions',
        badge: 'New',
        badgeVariant: 'primary',
        perform: () => {
          // The Tasks page itself only supports editing, not creating - the
          // Dashboard's "+ Add Task" modal is the real destination.
          router.push('/dashboard?new=1');
          onAction?.('new-task');
          closePalette();
        },
      },
      {
        id: 'action-new-course',
        title: 'Add New Course',
        subtitle: 'Manually add a course to your semester schedule',
        category: 'Actions',
        badge: 'New',
        badgeVariant: 'primary',
        perform: () => {
          router.push('/courses?new=1');
          onAction?.('new-course');
          closePalette();
        },
      },
      {
        id: 'action-ai-copilot',
        title: 'Ask AI Syllabus Copilot',
        subtitle: 'Query syllabus policies, grading scales, and late work rules',
        category: 'Actions',
        badge: 'AI Copilot',
        badgeVariant: 'primary',
        perform: () => {
          // The chat drawer's open/closed state lives in LayoutWrapper, not
          // here - onAction is the only path to it. Previously nothing
          // consumed this callback, so the palette just closed and nothing
          // else happened.
          onAction?.('ai-copilot');
          closePalette();
        },
      },
      {
        id: 'action-grade-simulator',
        title: 'What-If Grade Simulator',
        subtitle: 'Calculate target scores needed for final exams & target GPA',
        category: 'Actions',
        badge: 'Calc',
        perform: () => {
          router.push('/courses?simulator=true');
          onAction?.('grade-simulator');
          closePalette();
        },
      },
      {
        id: 'action-pomodoro',
        title: 'Start Pomodoro Focus Timer',
        subtitle: 'Launch 25/5 deep work study session linked to tasks',
        category: 'Actions',
        badge: 'Focus',
        perform: () => {
          // The timer widget's open/closed state is local to PomodoroTimer,
          // not reachable from here - onAction is the only path to it.
          onAction?.('pomodoro');
          closePalette();
        },
      },
    ];

    // Enrolled Courses
    for (const course of state.courses) {
      const loc = course.meetingTimes?.[0]?.location;
      items.push({
        id: `course-${course.id}`,
        title: `${course.code}: ${course.title}`,
        subtitle: [course.instructor, loc, course.term].filter(Boolean).join(' • '),
        category: 'Courses',
        badge: course.term ?? 'Course',
        badgeVariant: 'muted',
        perform: () => {
          router.push(`/courses/${course.id}`);
          closePalette();
        },
      });
    }

    // Schedule Items / Tasks
    const courseMap = new Map(state.courses.map((c) => [c.id, c]));
    for (const task of state.scheduleItems) {
      const course = courseMap.get(task.courseId);
      const isHigh = task.priority === 'high';
      items.push({
        id: `task-${task.id}`,
        title: task.title,
        subtitle: [
          course?.code,
          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
          task.completed ? 'Completed' : 'Pending',
        ]
          .filter(Boolean)
          .join(' • '),
        category: 'Tasks',
        badge: task.priority,
        badgeVariant: isHigh ? 'urgent' : 'muted',
        perform: () => {
          router.push(`/tasks/${task.id}`);
          closePalette();
        },
      });
    }

    return items;
  }, [
    state.courses,
    state.scheduleItems,
    state.contacts,
    state.flashcards,
    resolvedTheme,
    setTheme,
    router,
    closePalette,
    onAction,
  ]);

  // Filter commands by query and category filter
  const filteredCommands = useMemo(() => {
    let list = allCommands;
    if (activeFilter !== 'All') {
      list = list.filter((item) => item.category === activeFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(q);
      const badgeMatch = item.badge?.toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      return titleMatch || subtitleMatch || badgeMatch || catMatch;
    });
  }, [allCommands, activeFilter, query]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeFilter]);

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length > 0
          ? (prev - 1 + filteredCommands.length) % filteredCommands.length
          : 0,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].perform();
      }
    } else if (e.key === 'Tab') {
      // Focus trapping
      if (e.shiftKey && document.activeElement === inputRef.current) {
        e.preventDefault();
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-background/80 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl transition-all"
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-border/40 px-4 py-3.5">
          <svg
            className="h-5 w-5 text-muted-foreground mr-3 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.2-5.2m1.7-5.3a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Type a command, course, task, or page (or ${modKey}+P)...`}
            className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="rounded p-1 text-muted-foreground hover:text-foreground text-xs"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground font-mono">
              ESC
            </kbd>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/20 bg-muted/20 overflow-x-auto text-xs">
          {(['All', 'Navigation', 'Courses', 'Tasks', 'Actions'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Command List Results */}
        <div
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Command suggestions"
          className="max-h-96 overflow-y-auto p-2 divide-y divide-border/10"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <p className="font-medium">No results found for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Try searching for a course code, task name, or &quot;Dashboard&quot;.
              </p>
            </div>
          ) : (
            filteredCommands.map((command, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={command.id}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => command.perform()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted/40'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate text-sm font-medium">{command.title}</span>
                    {command.subtitle && (
                      <span className="truncate text-xs text-muted-foreground">
                        {command.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/60 tracking-wider">
                      {command.category}
                    </span>
                    {command.badge && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          command.badgeVariant === 'urgent'
                            ? 'bg-destructive/20 text-destructive'
                            : command.badgeVariant === 'primary'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {command.badge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border/30 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="font-mono bg-muted px-1 rounded">↵</kbd> Select
            </span>
            <span>
              <kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> Close
            </span>
          </div>
          <span>Syllabus Sense Command Center</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
