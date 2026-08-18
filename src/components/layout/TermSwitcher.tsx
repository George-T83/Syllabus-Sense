'use client';

import { useMemo } from 'react';
import { inferCurrentTerm, useAppState } from '@/context/AppStateContext';

/** #101 semester switcher. Hidden entirely when there's nothing to switch
 * between (zero or one distinct term across the user's courses) so it
 * doesn't clutter the navbar for the common case of a single-semester user. */
export function TermSwitcher() {
  const { state, dispatch } = useAppState();

  const terms = useMemo(
    () => Array.from(new Set(state.courses.map((c) => c.term).filter(Boolean))) as string[],
    [state.courses],
  );

  if (terms.length < 2) return null;

  // Mirrors resolveActiveTerm's fallback so the dropdown's displayed value
  // always matches what the rest of the app is actually scoped to, even
  // before the user has made an explicit choice.
  const displayValue = state.selectedTerm ?? inferCurrentTerm(state.courses) ?? 'all';

  return (
    <select
      value={displayValue}
      onChange={(e) =>
        dispatch({
          type: 'SELECT_TERM',
          payload: e.target.value === 'all' ? 'all' : e.target.value,
        })
      }
      aria-label="Select term"
      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="all">All Terms</option>
      {terms.map((term) => (
        <option key={term} value={term}>
          {term}
        </option>
      ))}
    </select>
  );
}
