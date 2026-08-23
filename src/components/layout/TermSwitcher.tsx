'use client';

import { useMemo, useState } from 'react';
import { inferCurrentTerm, useAppState } from '@/context/AppStateContext';
import { cn } from '@/lib/utils';

/** NV-4 (b): season ordering within a year - Spring < Summer < Fall < Winter.
 * Terms that don't parse (unrecognized format) sort after every parseable
 * term, alphabetically among themselves, rather than throwing or silently
 * keeping their arbitrary insertion order. */
const SEASON_ORDER: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };

function parseTermSortKey(term: string): number | null {
  const match = term.match(/(spring|summer|fall|winter)\s+(\d{4})/i);
  if (!match) return null;
  const season = match[1].toLowerCase();
  const year = Number(match[2]);
  return year * 10 + SEASON_ORDER[season];
}

function sortTermsChronologically(terms: string[]): string[] {
  return [...terms].sort((a, b) => {
    const keyA = parseTermSortKey(a);
    const keyB = parseTermSortKey(b);
    if (keyA !== null && keyB !== null) return keyA - keyB;
    if (keyA !== null) return -1;
    if (keyB !== null) return 1;
    return a.localeCompare(b);
  });
}

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

  const terms = useMemo(
    () =>
      sortTermsChronologically(
        Array.from(new Set(state.courses.map((c) => c.term).filter(Boolean))) as string[],
      ),
    [state.courses],
  );

  if (terms.length < 2) return null;

  // Mirrors resolveActiveTerm's fallback so the dropdown's displayed value
  // always matches what the rest of the app is actually scoped to, even
  // before the user has made an explicit choice.
  const displayValue = state.selectedTerm ?? inferCurrentTerm(state.courses) ?? 'all';
  const displayLabel = displayValue === 'all' ? 'All Terms' : displayValue;

  const select = (term: string) => {
    dispatch({ type: 'SELECT_TERM', payload: term });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select term"
        className="flex h-11 min-w-[7rem] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
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
          <div
            className="fixed inset-0 z-[60] bg-transparent"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            aria-label="Select term"
            className="absolute left-0 top-full z-[61] mt-2 w-full min-w-[9rem] overflow-hidden rounded-glass border border-border/40 bg-card glass shadow-glass"
          >
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
                key={term}
                type="button"
                role="option"
                aria-selected={displayValue === term}
                onClick={() => select(term)}
                className={cn(
                  'flex w-full items-center px-4 py-3 text-left text-sm font-medium transition-colors',
                  displayValue === term
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {term}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
