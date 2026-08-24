'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeProvider';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import type { Course, ScheduleItem } from '@/types/schedule';
import Logo from './Logo';
import { TermSwitcher } from './TermSwitcher';

/** NV-3: how far ahead of "now" a pending item counts as "due soon" in the
 * notification bell's dropdown (as opposed to "overdue"). Purely a display
 * bucket - doesn't affect the badge count, which mirrors the app's existing
 * overdue definition (see DashboardView's `overdueCount`). */
const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function SearchIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.2-5.2m1.7-5.3a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

/** Shared "click anywhere outside" catcher for the search/bell popovers,
 * matching the transparent full-screen backdrop pattern MobileTabBar's
 * "More" popover already uses elsewhere in the app. */
function PopoverBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-transparent"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

function useSearchResults(query: string) {
  const { state } = useAppState();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { courses: [] as Course[], tasks: [] as { item: ScheduleItem; course?: Course }[] };
    const courseById = new Map(state.courses.map((c) => [c.id, c]));
    const courses = state.courses
      .filter((c) => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 6);
    const tasks = state.scheduleItems
      .filter((item) => item.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((item) => ({ item, course: courseById.get(item.courseId) }));
    return { courses, tasks };
  }, [query, state.courses, state.scheduleItems]);
}

/** NV-3 (1/2): a lightweight, real search over the user's own courses and
 * tasks - client-side substring match against AppState, no backend call.
 * Not a command palette; just a working filtered list of clickable links. */
function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const { courses, tasks } = useSearchResults(query);
  const hasResults = courses.length > 0 || tasks.length > 0;

  return (
    <>
      <PopoverBackdrop onClose={onClose} />
      <div
        role="dialog"
        aria-label="Search courses and tasks"
        className="absolute right-0 top-full z-[61] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-glass border border-border/40 bg-card glass shadow-glass"
      >
        <div className="border-b border-border/40 p-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses and tasks…"
            aria-label="Search courses and tasks"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {query.trim() === '' ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Type to search your courses and tasks.
            </p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            <>
              {courses.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Courses
                  </p>
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="font-medium">{course.code}</span>
                      <span className="truncate text-muted-foreground">{course.title}</span>
                    </Link>
                  ))}
                </div>
              )}
              {tasks.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tasks
                  </p>
                  {tasks.map(({ item, course }) => (
                    <Link
                      key={item.id}
                      href={`/tasks/${item.id}`}
                      onClick={onClose}
                      className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="truncate">{item.title}</span>
                      {course && (
                        <span className="shrink-0 text-xs text-muted-foreground">{course.code}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function useOverdueAndDueSoon() {
  const { state } = useAppState();
  return useMemo(() => {
    const now = Date.now();
    const soonThreshold = now + DUE_SOON_WINDOW_MS;
    const courseById = new Map(state.courses.map((c) => [c.id, c]));
    const byDueDate = (a: ScheduleItem, b: ScheduleItem) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

    // Mirrors DashboardView's overdueCount: pending items whose due date has
    // already passed. Kept in sync deliberately rather than imported, since
    // this chrome component shouldn't reach into a page-level file.
    const overdue = state.scheduleItems
      .filter((item) => !item.completed && new Date(item.dueDate).getTime() < now)
      .sort(byDueDate);
    const dueSoon = state.scheduleItems
      .filter((item) => {
        if (item.completed) return false;
        const due = new Date(item.dueDate).getTime();
        return due >= now && due <= soonThreshold;
      })
      .sort(byDueDate);

    const withCourse = (item: ScheduleItem) => ({ item, course: courseById.get(item.courseId) });
    return {
      overdueCount: overdue.length,
      overdue: overdue.map(withCourse),
      dueSoon: dueSoon.map(withCourse),
    };
  }, [state.scheduleItems, state.courses]);
}

/** NV-3 (2/2): notification bell reusing the app's existing overdue
 * definition (badge count) and additionally surfacing due-soon items in the
 * dropdown, each a real link to that task. */
function NotificationBell({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { overdueCount, overdue, dueSoon } = useOverdueAndDueSoon();
  const hasAny = overdue.length > 0 || dueSoon.length > 0;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-label={overdueCount > 0 ? `Notifications, ${overdueCount} overdue` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <BellIcon />
        {overdueCount > 0 && (
          <span
            className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            aria-hidden="true"
          >
            {overdueCount > 9 ? '9+' : overdueCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <PopoverBackdrop onClose={onClose} />
          <div
            role="menu"
            aria-label="Notifications"
            className="absolute right-0 top-full z-[61] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-glass border border-border/40 bg-card glass shadow-glass"
          >
            <div className="max-h-80 overflow-y-auto py-1">
              {!hasAny ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Nothing overdue or due soon.</p>
              ) : (
                <>
                  {overdue.length > 0 && (
                    <div>
                      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                        Overdue
                      </p>
                      {overdue.map(({ item, course }) => (
                        <Link
                          key={item.id}
                          href={`/tasks/${item.id}`}
                          onClick={onClose}
                          role="menuitem"
                          className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="truncate">{item.title}</span>
                          {course && (
                            <span className="shrink-0 text-xs text-muted-foreground">{course.code}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  {dueSoon.length > 0 && (
                    <div>
                      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Due soon
                      </p>
                      {dueSoon.map(({ item, course }) => (
                        <Link
                          key={item.id}
                          href={`/tasks/${item.id}`}
                          onClick={onClose}
                          role="menuitem"
                          className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="truncate">{item.title}</span>
                          {course && (
                            <span className="shrink-0 text-xs text-muted-foreground">{course.code}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // NV-3: mutually exclusive so opening one popover closes the other.
  const [openPanel, setOpenPanel] = useState<'search' | 'bell' | null>(null);

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) router.push('/login');
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 glass border-b border-border/40 bg-card/80 flex items-center justify-between px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Logo / App Name */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity"
        >
          <Logo className="h-9 w-9 shrink-0 sm:h-14 sm:w-14" />
          <span className="hidden sm:inline">Syllabus Sense</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {mounted && user && <TermSwitcher />}
        {mounted && user && (
          <div className="relative">
            <button
              onClick={() => setOpenPanel((p) => (p === 'search' ? null : 'search'))}
              aria-label="Search courses and tasks"
              aria-haspopup="dialog"
              aria-expanded={openPanel === 'search'}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              <SearchIcon />
            </button>
            {openPanel === 'search' && <SearchPanel onClose={() => setOpenPanel(null)} />}
          </div>
        )}
        {mounted && user && (
          <NotificationBell
            open={openPanel === 'bell'}
            onToggle={() => setOpenPanel((p) => (p === 'bell' ? null : 'bell'))}
            onClose={() => setOpenPanel(null)}
          />
        )}
        {mounted && user && (
          <Link
            href="/profile"
            className="hidden sm:inline-flex min-h-[44px] items-center text-sm font-medium text-foreground hover:text-primary transition-colors px-1"
          >
            Hi, {user.displayName || user.email?.split('@')[0] || 'there'}
          </Link>
        )}
        {!mounted ? (
          <button
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground opacity-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            aria-hidden="true"
            disabled
          >
            <div className="h-6 w-6" />
          </button>
        ) : (
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {resolvedTheme === 'dark' ? (
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Sign out"
          title="Sign out"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
