'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppState } from '@/context/AppStateContext';
import { computeSmartPlan, getLocalReferenceDate } from '@/lib/planner/computeSmartPlan';
import { DAILY_SCHEDULING_CAPACITY_HOURS } from '@/lib/workload';
import { loadSessions } from '@/lib/focus/pomodoroSessions';
import { getSessionDateSet, computeCurrentStreak } from '@/lib/focus/studyStreak';
import { NavIcon, DegreeNavIcon } from './NavIcon';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped by how the work actually flows, not shipped-feature order - the
// same grouping approved in the design concept (Sidebar.dc.html,
// claude.ai/artifact/4AvwgJrMEGmGDRMmVAEAPn), replacing a flat 11-item list
// that read as a feature inventory rather than a model of the work.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/dashboard', icon: <NavIcon name="dashboard" /> }],
  },
  {
    label: 'Coursework',
    items: [
      { name: 'Courses', href: '/courses', icon: <NavIcon name="courses" /> },
      { name: 'Tasks', href: '/tasks', icon: <NavIcon name="tasks" /> },
      { name: 'Flashcards', href: '/flashcards', icon: <NavIcon name="flashcards" /> },
      { name: 'Quizzes', href: '/quizzes', icon: <NavIcon name="quizzes" /> },
    ],
  },
  {
    label: 'Planning',
    items: [
      { name: 'Advisor', href: '/advisor', icon: <NavIcon name="advisor" /> },
      { name: 'Degree', href: '/degree-compass', icon: <DegreeNavIcon /> },
      { name: 'Calendar', href: '/calendar', icon: <NavIcon name="calendar" /> },
    ],
  },
  {
    label: 'You',
    items: [
      { name: 'Contacts', href: '/contacts', icon: <NavIcon name="contacts" /> },
      { name: 'Mood', href: '/mood', icon: <NavIcon name="mood" /> },
      { name: 'Profile', href: '/profile', icon: <NavIcon name="profile" /> },
    ],
  },
];

function StreakFlameIcon() {
  return (
    <svg className="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c1 3-2 4.5-2 7.5A4 4 0 0 0 14 14c0-1 .3-1.6.8-2.3.9 1.2 1.2 2.6 1.2 3.8 0 3.6-2.7 6.5-6 6.5S4 19.1 4 15.5C4 10.5 9.5 7 12 2Z" />
    </svg>
  );
}

/** Today's runway ring + study streak - a live footer widget replacing the
 * dead space that used to sit below Profile, so the sidebar itself says
 * something about right now instead of only being a list of destinations.
 * Ring % is real (today's scheduled hours against the app's own daily
 * scheduling capacity, lib/workload's DAILY_SCHEDULING_CAPACITY_HOURS), and
 * the streak reuses StudyStreakCard's exact localStorage logic - no new
 * data source either way. */
function SidebarFooterWidget() {
  const { state } = useAppState();
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setMounted(true);
    setStreak(computeCurrentStreak(getSessionDateSet(loadSessions())));
  }, []);

  const percent = useMemo(() => {
    const referenceDate = getLocalReferenceDate();
    const plan = computeSmartPlan(state.scheduleItems, referenceDate);
    const hours = plan.weekLoad[0].hours;
    return Math.max(0, Math.min(100, Math.round((hours / DAILY_SCHEDULING_CAPACITY_HOURS) * 100)));
  }, [state.scheduleItems]);

  if (!mounted) return null;

  const circumference = 2 * Math.PI * 15.5;
  const dashOffset = circumference * (1 - percent / 100);

  return (
    // mb-20 (not the usual mb-4) - PomodoroTimer's floating pill sits fixed
    // at bottom-6 left-6 on desktop (LayoutWrapper renders it unconditionally
    // whenever signed in), directly over the sidebar's own bottom-left
    // corner. Without this clearance this widget renders right behind it.
    <div className="mx-4 mt-auto mb-20 flex items-center gap-3 rounded-2xl bg-accent/50 px-3 py-3">
      <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="3.5"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="url(#sidebarRingGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 18 18)"
        />
        <defs>
          <linearGradient id="sidebarRingGrad" x1="0" y1="0" x2="36" y2="36">
            <stop offset="0%" stopColor="#8C6EFF" />
            <stop offset="100%" stopColor="#00BFA0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="min-w-0 flex flex-col">
        <span className="font-display text-sm font-semibold leading-tight text-foreground">
          {percent}% today
        </span>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="text-load-medium">
              <StreakFlameIcon />
            </span>
            {streak} day streak
          </span>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed top-20 bottom-0 left-0 z-[45] w-64 flex-col border-r border-border/40 bg-card/90 glass">
      <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-4 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            {group.items.map((item) => {
              // NV-1: a plain exact match goes fully un-highlighted the
              // moment a student drills one level deeper than a top-level
              // route (e.g. /courses/[id] or /tasks/[id] never equals
              // /courses or /tasks). A prefix match keeps the parent
              // section highlighted for every nested route underneath it.
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-brand text-primary-foreground shadow-[0_8px_20px_-8px_rgba(91,61,245,0.6)]'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <SidebarFooterWidget />
    </aside>
  );
}
