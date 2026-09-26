'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeProvider';
import { cn } from '@/lib/utils';

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

/**
 * The light/dark switch, shared by the app navbar and the marketing page.
 * The resolved theme is only known on the client, so it renders a same-size
 * placeholder until mounted rather than a server-guessed icon that would
 * flip (and mismatch hydration) on load.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={cn('h-9 w-9 shrink-0', className)} aria-hidden="true" />;

  const dark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-accent/60 text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
        className,
      )}
    >
      <ThemeIcon dark={dark} />
    </button>
  );
}
