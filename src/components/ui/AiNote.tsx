import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A short, quiet note for anything an AI produced or estimated: what it is,
 * and that it can be wrong. Kept to one line of small muted text so it can sit
 * under a number without competing with it.
 */
export function AiNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
