'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavIcon, DegreeNavIcon } from './NavIcon';

interface TabItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const tabItems: TabItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: <NavIcon name="dashboard" /> },
  { name: 'Courses', href: '/courses', icon: <NavIcon name="courses" /> },
  { name: 'Tasks', href: '/tasks', icon: <NavIcon name="tasks" /> },
  { name: 'Calendar', href: '/calendar', icon: <NavIcon name="calendar" /> },
];

const moreItems: TabItem[] = [
  { name: 'Flashcards', href: '/flashcards', icon: <NavIcon name="flashcards" /> },
  { name: 'Quizzes', href: '/quizzes', icon: <NavIcon name="quizzes" /> },
  { name: 'Planner', href: '/planner', icon: <NavIcon name="plannerList" /> },
  { name: 'Degree', href: '/degree-compass', icon: <DegreeNavIcon /> },
  { name: 'Mood', href: '/mood', icon: <NavIcon name="mood" /> },
  { name: 'Profile', href: '/profile', icon: <NavIcon name="profile" /> },
  { name: 'Contacts', href: '/contacts', icon: <NavIcon name="contacts" /> },
];

function TabLink({ item, isActive }: { item: TabItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {item.icon}
      <span>{item.name}</span>
      <span
        className={cn(
          'h-[3px] w-[3px] rounded-full bg-primary transition-opacity',
          isActive ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      />
    </Link>
  );
}

export default function MobileTabBar() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isMoreActive = moreItems.some((item) => pathname === item.href);

  return (
    <>
      {/* Backdrop for the "More" popover — closes on tap-outside */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-[55] bg-transparent md:hidden"
          onClick={() => setIsMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-border/40 bg-card/80 glass pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {tabItems.map((item) => (
          <TabLink key={item.href} item={item} isActive={pathname === item.href} />
        ))}

        <div className="relative flex flex-1">
          {isMoreOpen && (
            <div
              className="absolute bottom-full right-0 z-[56] mb-2 w-40 overflow-hidden rounded-xl border border-border/40 bg-card glass shadow-glass"
              role="menu"
            >
              {moreItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    role="menuitem"
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
              isMoreOpen || isMoreActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            aria-label="More navigation options"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12h.01M12 12h.01M18 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm6 0a1 1 0 11-2 0 1 1 0 012 0zm6 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </svg>
            <span>More</span>
            <span
              className={cn(
                'h-[3px] w-[3px] rounded-full bg-primary transition-opacity',
                isMoreActive ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </nav>
    </>
  );
}
