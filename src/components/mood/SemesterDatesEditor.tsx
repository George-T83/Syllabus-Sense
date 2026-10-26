'use client';

import { useState } from 'react';
import { CardActionButton } from '@/components/ui/CardAction';
import { validateSemesterDates, type SemesterDates } from '@/lib/mood/semesterRange';

const inputClass =
  'min-h-11 w-full rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

interface SemesterDatesEditorProps {
  term: string;
  initial: SemesterDates | null;
  /** Offered only when the student has saved their own dates for a term that
   * also has standard ones. */
  onUseStandard?: () => void;
  onSave: (dates: SemesterDates) => void;
  onCancel?: () => void;
}

/** First and last day of a term, with the same validation the grid applies
 * when it reads them back. */
export function SemesterDatesEditor({
  term,
  initial,
  onUseStandard,
  onSave,
  onCancel,
}: SemesterDatesEditorProps) {
  const [start, setStart] = useState(initial?.start ?? '');
  const [end, setEnd] = useState(initial?.end ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateSemesterDates(start, end);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave({ start, end });
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" aria-label={`${term} dates`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="semester-start" className="text-xs font-semibold text-muted-foreground">
            First day of {term}
          </label>
          <input
            id="semester-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="semester-end" className="text-xs font-semibold text-muted-foreground">
            Last day of {term}
          </label>
          <input
            id="semester-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-load-critical">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <CardActionButton variant="solid" type="submit">
          Save dates
        </CardActionButton>
        {onCancel && (
          <CardActionButton variant="ghost" onClick={onCancel}>
            Cancel
          </CardActionButton>
        )}
        {onUseStandard && (
          <CardActionButton variant="ghost" onClick={onUseStandard}>
            Use standard dates
          </CardActionButton>
        )}
      </div>
    </form>
  );
}
