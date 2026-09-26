import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface RowActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `destructive` for Delete/Remove; everything else is `primary`. */
  tone?: 'primary' | 'destructive';
}

/**
 * The Edit / Delete buttons at the end of a list row (tasks, contacts,
 * objectives, materials, syllabi, degree courses). A tinted pill even at
 * rest - the same treatment as the page's other pill actions - rather than
 * text that only shows it's a button on hover.
 */
export function RowActionButton({
  tone = 'primary',
  className,
  type = 'button',
  ...rest
}: RowActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50',
        tone === 'destructive'
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
          : 'bg-primary/10 text-primary hover:bg-primary/20',
        className,
      )}
      {...rest}
    />
  );
}
