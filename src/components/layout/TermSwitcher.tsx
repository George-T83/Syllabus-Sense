'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { TermFormModal } from '@/components/terms/TermFormModal';
import { resolveActiveTerm, sortTerms } from '@/lib/terms/termResolve';
import { cn } from '@/lib/utils';

/** #101 semester switcher. Hidden entirely when there's nothing to switch
 * between (zero or one distinct term across the user's courses) so it
 * doesn't clutter the navbar for the common case of a single-semester user.
 *
 * NV-4: rebuilt as a custom pill/glass dropdown (matching the rest of the
 * app's chrome) instead of a bare native `<select>`, with a real 44px+ tap
 * target, and with its options sorted chronologically by parsed year+season
 * rather than left in insertion order. */
export function TermSwitcher() {
  const { state, dispatch } = useAppState();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const [creating, setCreating] = useState(false);
  const terms = useMemo(() => sortTerms(state.terms), [state.terms]);

  // Only offered once there is something to switch between. The first term
  // is created where a course is added (or on the Mood page), not here.
  if (terms.length < 2) return null;

  // Mirrors resolveActiveTerm's fallback so the dropdown's displayed value
  // always matches what the rest of the app is actually scoped to, even
  // before the user has made an explicit choice.
  const active = resolveActiveTerm(state.selectedTerm, state.courses, state.terms);
  const displayValue = active?.id ?? 'all';
  const displayLabel = active?.label ?? 'All Terms';

  const select = (termId: string) => {
    dispatch({ type: 'SELECT_TERM', payload: termId });
    close();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select term"
        className="flex h-11 min-w-[7rem] items-center justify-between gap-2 rounded-lg border border-border bg-input px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60] bg-transparent" onClick={close} aria-hidden="true" />
          <div className="absolute left-0 top-full z-[61] mt-2 w-full min-w-[9rem] overflow-hidden rounded-glass border border-border/40 bg-card glass shadow-glass">
            <div role="listbox" aria-label="Select term">
              <button
                type="button"
                role="option"
                aria-selected={displayValue === 'all'}
                onClick={() => select('all')}
                className={cn(
                  'flex w-full items-center px-4 py-3 text-left text-sm font-medium transition-colors',
                  displayValue === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                All Terms
              </button>
              {terms.map((term) => (
                <button
                  key={term.id}
                  type="button"
                  role="option"
                  aria-selected={displayValue === term.id}
                  onClick={() => select(term.id)}
                  className={cn(
                    'flex w-full items-center px-4 py-3 text-left text-sm font-medium transition-colors',
                    displayValue === term.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {term.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setOpen(false);
              }}
              className="flex w-full items-center border-t border-border/40 px-4 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              + New term…
            </button>
          </div>
        </>
      )}
      <TermFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(term) => dispatch({ type: 'SELECT_TERM', payload: term.id })}
      />
    </div>
  );
}
