'use client';

import { useState, type KeyboardEvent } from 'react';
import { CardActionButton } from '@/components/ui/CardAction';
import { standardTermDates, termLabelKey, validateTermDates } from '@/lib/terms/standardTerms';
import { cn } from '@/lib/utils';
import type { Term } from '@/types/term';

const inputClass =
  'min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

interface TermFormProps {
  /** Present when editing a stored term. */
  initialTerm?: Term;
  /** A label to start from when creating one (e.g. a syllabus's term). */
  suggestedLabel?: string;
  existingTerms: Term[];
  /** Persists the term. A rejection is shown to the student. */
  onSave: (term: Term) => Promise<void>;
  onCancel: () => void;
  /** Makes element ids unique when the form sits inside another form. */
  idPrefix?: string;
  saveLabel?: string;
}

/**
 * Creates or edits a term: a label and its first and last day. For a label
 * it recognizes (Fall, Spring or Summer plus a year) the dates start filled
 * in with the usual ones, so creating a term is confirm-or-adjust. They are
 * only a suggestion in the form: nothing is stored until the student saves,
 * and once they edit a date it is never overwritten.
 *
 * Deliberately not a <form>: it is also used inside the course form, and a
 * form cannot nest. Enter in a field saves.
 */
export function TermForm({
  initialTerm,
  suggestedLabel,
  existingTerms,
  onSave,
  onCancel,
  idPrefix = 'term',
  saveLabel = 'Save term',
}: TermFormProps) {
  const startingLabel = initialTerm?.label ?? suggestedLabel ?? '';
  const startingDates = initialTerm
    ? { startDate: initialTerm.startDate, endDate: initialTerm.endDate }
    : standardTermDates(startingLabel);

  const [label, setLabel] = useState(startingLabel);
  const [startDate, setStartDate] = useState(startingDates?.startDate ?? '');
  const [endDate, setEndDate] = useState(startingDates?.endDate ?? '');
  // True once the student has set a date themselves (or is editing a stored
  // term): from then on a change of label never replaces their dates.
  const [datesTouched, setDatesTouched] = useState(Boolean(initialTerm));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestion = standardTermDates(label);
  const showingSuggestion =
    !datesTouched &&
    suggestion !== null &&
    startDate === suggestion.startDate &&
    endDate === suggestion.endDate;

  const changeLabel = (next: string) => {
    if (initialTerm) return;
    setLabel(next);
    setError(null);
    if (!datesTouched) {
      const std = standardTermDates(next);
      setStartDate(std?.startDate ?? '');
      setEndDate(std?.endDate ?? '');
    }
  };

  const save = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Give the term a name, like “Fall 2026”.');
      return;
    }
    const clash = existingTerms.find(
      (t) => t.id !== initialTerm?.id && termLabelKey(t.label) === termLabelKey(trimmed),
    );
    if (clash) {
      setError(`You already have a term called “${clash.label}”.`);
      return;
    }
    const problem = validateTermDates(startDate, endDate);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        id: initialTerm?.id ?? crypto.randomUUID(),
        label: trimmed,
        startDate,
        endDate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save the term. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Enter in a field saves; on a button it must keep doing what that
    // button does (Cancel cancels).
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div className="space-y-3" onKeyDown={onKeyDown} role="group" aria-label="Term details">
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-label`} className="text-sm font-medium text-foreground">
          Term name
        </label>
        <input
          id={`${idPrefix}-label`}
          value={label}
          placeholder="Fall 2026"
          onChange={(e) => changeLabel(e.target.value)}
          // A stored term's name is copied onto its courses and contacts, so
          // editing a term changes its days only.
          readOnly={Boolean(initialTerm)}
          aria-readonly={initialTerm ? true : undefined}
          className={cn(
            inputClass,
            'border-border',
            initialTerm && 'bg-muted/40 text-muted-foreground',
          )}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-start`} className="text-sm font-medium text-foreground">
            First day
          </label>
          <input
            id={`${idPrefix}-start`}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatesTouched(true);
              setError(null);
            }}
            className={cn(inputClass, 'border-border')}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-end`} className="text-sm font-medium text-foreground">
            Last day
          </label>
          <input
            id={`${idPrefix}-end`}
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDatesTouched(true);
              setError(null);
            }}
            className={cn(inputClass, 'border-border')}
          />
        </div>
      </div>
      {showingSuggestion && (
        <p className="text-xs text-muted-foreground" data-testid="term-standard-hint">
          The usual dates for {label.trim()} are filled in. Change them if your school’s term runs
          differently.
        </p>
      )}
      {!datesTouched && suggestion === null && label.trim() !== '' && !startDate && (
        <p className="text-xs text-muted-foreground" data-testid="term-no-standard-hint">
          There are no usual dates for “{label.trim()}”. Enter its first and last day.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <CardActionButton variant="solid" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </CardActionButton>
        <CardActionButton variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </CardActionButton>
      </div>
    </div>
  );
}
