'use client';

import { useEffect } from 'react';

/**
 * Root error boundary for the App Router segment tree. Catches render-time
 * exceptions in any page/layout under this one that isn't already handling
 * its own error state, so a bug in one view doesn't take down the whole app
 * with a blank white screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-modal">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-load-critical/15 text-load-critical">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-base font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          An unexpected error occurred. Your data is safe — try again, or reload the page.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            Go to dashboard
          </button>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
