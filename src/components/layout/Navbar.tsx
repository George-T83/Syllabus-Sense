'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeProvider';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/components/ui/Toast';
import { CountBadge } from '@/components/ui/CountBadge';
import { usePopoverA11y } from '@/hooks/usePopoverA11y';
import { groupByUrgency } from '@/lib/notifications/urgencyGrouping';
import { loadSessions } from '@/lib/focus/pomodoroSessions';
import { getSessionDateSet, computeCurrentStreak } from '@/lib/focus/studyStreak';
import type { ScheduleItem } from '@/types/schedule';
import Logo from './Logo';
import { TermSwitcher } from './TermSwitcher';
import { CommandPalette } from '@/components/common/CommandPalette';
import { usePlatformKey } from '@/hooks/usePlatformKey';

/** Every icon here shares one language with the compass mark: rounded caps,
 * a single ~1.8 stroke weight, no filled Heroicons-style glyphs - so the bar
 * reads as drawn by one hand instead of borrowing a stock icon set. */
function CompassSearchIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 9a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function StreakFlameIcon() {
  return (
    <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c1 3-2 4.5-2 7.5A4 4 0 0 0 14 14c0-1 .3-1.6.8-2.3.9 1.2 1.2 2.6 1.2 3.8 0 3.6-2.7 6.5-6 6.5S4 19.1 4 15.5C4 10.5 9.5 7 12 2Z" />
    </svg>
  );
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg
      className="h-[16px] w-[16px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19v2.4M4.5 12H2M22 12h-2.4M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" />
    </svg>
  ) : (
    <svg
      className="h-[16px] w-[16px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

/** Shared "click anywhere outside" catcher for the search/bell popovers,
 * matching the transparent full-screen backdrop pattern MobileTabBar's
 * "More" popover already uses elsewhere in the app. */
function PopoverBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-transparent" onClick={onClose} aria-hidden="true" />
  );
}

/** A rounded icon-tile shell shared by the notification/theme/sign-out
 * buttons, replacing the old bare hover-background circle so the three
 * utility actions read as one consistent icon language instead of plain
 * unstyled buttons that happen to sit next to each other. */
function IconTileButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-accent/60 text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${className}`}
    >
      {children}
    </button>
  );
}

type CourseSummary = { code: string };

/** One urgency tier's rows in the notification dropdown - extracted since
 * the same title+link+course-code markup now repeats across four tiers
 * instead of the previous two. */
function NotificationTier({
  label,
  labelClassName,
  entries,
  onClose,
}: {
  label: string;
  labelClassName: string;
  entries: { item: ScheduleItem; course: CourseSummary | undefined }[];
  onClose: () => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p
        className={`px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide ${labelClassName}`}
      >
        {label}
      </p>
      {entries.map(({ item, course }) => (
        <Link
          key={item.id}
          href={`/tasks/${item.id}`}
          onClick={onClose}
          role="menuitem"
          className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="truncate">{item.title}</span>
          {course && <span className="shrink-0 text-xs text-muted-foreground">{course.code}</span>}
        </Link>
      ))}
    </div>
  );
}

/** NV-3 + urgency-aware notifications: same overdue definition as before
 * (mirrors DashboardView's `overdueCount`, kept in sync deliberately rather
 * than imported since this chrome component shouldn't reach into a
 * page-level file), now split into urgency tiers via `groupByUrgency` -
 * "due today"/"due this week" replace the old flat 3-day "due soon" window,
 * plus a "high-stakes ahead" tier that surfaces a heavily-weighted item
 * further out than an ordinary one would be. */
function useUrgencyGroups() {
  const { state } = useAppState();
  return useMemo(() => {
    const now = Date.now();
    const courseById = new Map(state.courses.map((c) => [c.id, c]));
    const withCourse = (item: ScheduleItem) => ({ item, course: courseById.get(item.courseId) });
    const groups = groupByUrgency(state.scheduleItems, now);

    return {
      overdueCount: groups.overdue.length,
      overdue: groups.overdue.map(withCourse),
      dueToday: groups.dueToday.map(withCourse),
      dueThisWeek: groups.dueThisWeek.map(withCourse),
      highStakesAhead: groups.highStakesAhead.map(withCourse),
    };
  }, [state.scheduleItems, state.courses]);
}

/** Read once on mount, same as StudyStreakCard - Pomodoro sessions are
 * localStorage-only (lib/focus/pomodoroSessions.ts), so this is a per-device
 * metric, not an account-wide one, and only meaningfully changes once a
 * session actually completes. */
function useStudyStreak(): number {
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    setStreak(computeCurrentStreak(getSessionDateSet(loadSessions())));
  }, []);
  return streak;
}

/** NV-3 (2/2): notification bell reusing the app's existing overdue
 * definition (badge count) and additionally surfacing upcoming items by
 * urgency tier in the dropdown, each a real link to that task. */
function NotificationBell({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { overdueCount, overdue, dueToday, dueThisWeek, highStakesAhead } = useUrgencyGroups();
  const hasAny =
    overdue.length > 0 ||
    dueToday.length > 0 ||
    dueThisWeek.length > 0 ||
    highStakesAhead.length > 0;
  usePopoverA11y(open, onClose);

  return (
    <div className="relative">
      <IconTileButton
        onClick={onToggle}
        aria-label={overdueCount > 0 ? `Notifications, ${overdueCount} overdue` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BellIcon />
        {overdueCount > 0 && <CountBadge count={overdueCount} className="absolute top-1 right-1" />}
      </IconTileButton>
      {open && (
        <>
          <PopoverBackdrop onClose={onClose} />
          <div
            role="menu"
            aria-label="Notifications"
            className="absolute right-0 top-full z-[61] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-glass border border-border/40 bg-card shadow-glass"
          >
            <div className="max-h-80 overflow-y-auto py-1">
              {!hasAny ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Nothing overdue or coming up.
                </p>
              ) : (
                <>
                  <NotificationTier
                    label="Overdue"
                    labelClassName="text-destructive"
                    entries={overdue}
                    onClose={onClose}
                  />
                  <NotificationTier
                    label="Due today"
                    labelClassName="text-primary"
                    entries={dueToday}
                    onClose={onClose}
                  />
                  <NotificationTier
                    label="Due this week"
                    labelClassName="text-muted-foreground"
                    entries={dueThisWeek}
                    onClose={onClose}
                  />
                  <NotificationTier
                    label="High-stakes ahead"
                    labelClassName="text-amber-600 dark:text-amber-400"
                    entries={highStakesAhead}
                    onClose={onClose}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export interface NavbarProps {
  /** Forwarded to CommandPalette's onAction - handles actions (AI Copilot,
   * Pomodoro) whose state lives in LayoutWrapper, outside what Navbar or
   * CommandPalette can reach on their own. */
  onCommandPaletteAction?: (actionId: string) => void;
}

export default function Navbar({ onCommandPaletteAction }: NavbarProps = {}) {
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { showError } = useToast();
  const [mounted, setMounted] = useState(false);
  const [openPanel, setOpenPanel] = useState<'search' | 'bell' | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const modKey = usePlatformKey();
  const streak = useStudyStreak();

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) {
      router.push('/login');
    } else {
      showError('Could not sign out', 'Please try again in a moment.');
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && window.location.search.includes('cmd=true')) {
      setIsCommandPaletteOpen(true);
    }
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 glass border-b border-border/40 bg-card/80 flex items-center justify-between px-3 sm:px-6 gap-3">
      {/* Mark + wordmark */}
      <Link
        href="/"
        className="flex items-center gap-2.5 shrink-0 text-lg font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity"
      >
        <Logo className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
        <span className="hidden font-display font-semibold sm:inline">Syllabus Sense</span>
      </Link>

      {/* AI command bar - the centerpiece, not a corner search box */}
      {mounted && user && (
        <div className="flex-1 flex justify-center min-w-0">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-label={`Open command palette (${modKey}+P)`}
            className="hidden md:inline-flex w-full max-w-[560px] items-center gap-2.5 rounded-full border border-primary/20 bg-accent/50 px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:bg-accent transition-all focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          >
            <span className="text-primary">
              <CompassSearchIcon />
            </span>
            <span className="truncate flex-1 text-left">
              Ask anything — grades, deadlines, study plans…
            </span>
            <kbd className="shrink-0 rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[10px] font-mono">
              {modKey}+P
            </kbd>
          </button>
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-label={`Search courses and tasks (${modKey}+P)`}
            className="md:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            <CompassSearchIcon />
          </button>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onOpen={() => setIsCommandPaletteOpen(true)}
            onAction={onCommandPaletteAction}
          />
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {mounted && user && <TermSwitcher />}

        {/* Momentum chip - real streak data, replaces static greeting text */}
        {mounted && user && streak > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-load-medium/10 px-3 py-1.5">
            <span className="text-load-medium">
              <StreakFlameIcon />
            </span>
            <span className="font-mono text-xs font-bold text-load-medium">{streak}</span>
            <span className="text-[11px] text-load-medium/80">day streak</span>
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
            className="hidden lg:inline-flex min-h-[44px] items-center text-sm font-medium text-foreground hover:text-primary transition-colors px-1"
          >
            Hi, {user.displayName || user.email?.split('@')[0] || 'there'}
          </Link>
        )}

        {!mounted ? (
          <div className="h-9 w-9 shrink-0" aria-hidden="true" />
        ) : (
          <IconTileButton
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <ThemeIcon dark={resolvedTheme === 'dark'} />
          </IconTileButton>
        )}

        <IconTileButton onClick={handleSignOut} aria-label="Sign out" title="Sign out">
          <SignOutIcon />
        </IconTileButton>
      </div>
    </header>
  );
}
