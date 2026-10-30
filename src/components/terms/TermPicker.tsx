'use client';

import { useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { TermForm } from '@/components/terms/TermForm';
import { useSaveTerm } from '@/components/terms/useSaveTerm';
import { LEGACY_TERM_VALUE, sortTerms } from '@/lib/terms/termResolve';
import { cn } from '@/lib/utils';

const NEW_TERM_VALUE = '__new__';

interface TermPickerProps {
  id: string;
  label?: string;
  /** A term id, LEGACY_TERM_VALUE, or '' for no term. */
  value: string;
  onChange: (value: string) => void;
  /** The course's own label when it has no term object yet. */
  legacyLabel?: string;
  /** A label to start a new term from. */
  suggestedLabel?: string;
  error?: string;
}

/**
 * Chooses a course's term from the student's terms, or creates one on the
 * spot: "New term…" opens the term form right under the field, with the
 * usual dates filled in for a known label.
 */
export function TermPicker({
  id,
  label = 'Term',
  value,
  onChange,
  legacyLabel,
  suggestedLabel,
  error,
}: TermPickerProps) {
  const { state } = useAppState();
  const save = useSaveTerm();
  const [creating, setCreating] = useState(false);
  const terms = sortTerms(state.terms);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === NEW_TERM_VALUE) {
            setCreating(true);
            return;
          }
          setCreating(false);
          onChange(e.target.value);
        }}
        className={cn(
          'min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
          error ? 'border-destructive' : 'border-border',
        )}
      >
        <option value="">No term</option>
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
        {legacyLabel && <option value={LEGACY_TERM_VALUE}>{legacyLabel} (needs dates)</option>}
        <option value={NEW_TERM_VALUE}>+ New term…</option>
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {creating && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <TermForm
            idPrefix={`${id}-new`}
            suggestedLabel={suggestedLabel ?? legacyLabel}
            existingTerms={state.terms}
            onSave={async (term) => {
              await save(term);
              onChange(term.id);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
    </div>
  );
}
