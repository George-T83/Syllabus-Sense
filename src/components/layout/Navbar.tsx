'use client';

import React from 'react';
import Link from 'next/link';
import { useSidebar } from './SidebarContext';
import Logo from './Logo';

export default function Navbar() {
  const { toggle } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 glass border-b border-border/40 bg-card/80 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Button */}
        <button
          onClick={toggle}
          className="p-2 rounded-md hover:bg-accent text-foreground md:hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Toggle Navigation Menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo / App Name */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity"
        >
          <Logo className="h-14 w-14 shrink-0" />
          Syllabus Sense
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Placeholder for any user actions or theme toggles in the future */}
      </div>
    </header>
  );
}
