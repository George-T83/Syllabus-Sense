'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavIcon, DegreeNavIcon } from './NavIcon';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: <NavIcon name="dashboard" /> },
    { name: 'Courses', href: '/courses', icon: <NavIcon name="courses" /> },
    { name: 'Advisor', href: '/advisor', icon: <NavIcon name="advisor" /> },
    { name: 'Degree', href: '/degree-compass', icon: <DegreeNavIcon /> },
    { name: 'Contacts', href: '/contacts', icon: <NavIcon name="contacts" /> },
    { name: 'Tasks', href: '/tasks', icon: <NavIcon name="tasks" /> },
    { name: 'Flashcards', href: '/flashcards', icon: <NavIcon name="flashcards" /> },
    { name: 'Quizzes', href: '/quizzes', icon: <NavIcon name="quizzes" /> },
    { name: 'Planner', href: '/planner', icon: <NavIcon name="plannerList" /> },
    { name: 'Calendar', href: '/calendar', icon: <NavIcon name="calendar" /> },
    { name: 'Mood', href: '/mood', icon: <NavIcon name="mood" /> },
    { name: 'Profile', href: '/profile', icon: <NavIcon name="profile" /> },
  ];

  return (
    <aside className="hidden md:flex fixed top-20 bottom-0 left-0 z-[45] w-64 flex-col border-r border-border/40 bg-card/90 glass">
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navItems.map((item) => {
          // NV-1: a plain exact match goes fully un-highlighted the moment
          // a student drills one level deeper than a top-level route (e.g.
          // /courses/[id] or /tasks/[id] never equals /courses or /tasks).
          // A prefix match keeps the parent section highlighted for every
          // nested route underneath it.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
