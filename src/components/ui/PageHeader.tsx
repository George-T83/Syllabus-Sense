import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Small tracked label above the title - the page's section ("Coursework"). */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Header actions (CardActionButton etc.), right-aligned on wide screens. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The one page title every screen uses, in the Study Space's type language:
 * a tracked uppercase eyebrow over a serif display title (the same Fraunces
 * the flashcard question and readiness numbers are set in).
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
