'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { useAuth } from '@/context/AuthContext';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useSaveTerm } from '@/components/terms/useSaveTerm';
import { termLabelKey, validateTermDates } from '@/lib/terms/standardTerms';
import { termIdForLabel } from '@/lib/terms/termMigration';

const inputClass =
  'min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

const storageKey = (uid: string) => `syllabus-sense-term-prompt:${uid}`;

function readPrompted(uid: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(uid)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writePrompted(uid: string, keys: string[]) {
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(keys));
  } catch {
    // Private browsing: the prompt may show again next visit.
  }
}

/**
 * Asked once, after courses load, for the terms the app could not date by
 * itself: course term labels with no standard dates. Each row is a label with
 * a first and last day to fill in. Closing the dialog (saved or not) marks
 * those labels as asked, so it does not come back every visit; a label left
 * undated can still be given dates from the term picker on a course or from
 * the Mood page.
 */
export function TermMigrationPrompt({ labels }: { labels: string[] }) {
  const { user } = useAuth();
  const save = useSaveTerm();
  const [closed, setClosed] = useState(false);
  const pending = useMemo(() => {
    if (!user || closed || typeof window === 'undefined') return [];
    const asked = new Set(readPrompted(user.uid));
    return labels.filter((l) => !asked.has(termLabelKey(l)));
  }, [labels, user, closed]);

  const [dates, setDates] = useState<Record<string, { start: string; end: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = pending.length > 0;
  const finish = () => {
    if (user) writePrompted(user.uid, [...readPrompted(user.uid), ...pending.map(termLabelKey)]);
    setClosed(true);
  };
  const dialogRef = useModalA11y<HTMLDivElement>(open, finish);

  if (!open) return null;

  const rowFor = (label: string) => dates[termLabelKey(label)] ?? { start: '', end: '' };
  const setRow = (label: string, patch: Partial<{ start: string; end: string }>) => {
    setError(null);
    setDates((d) => ({ ...d, [termLabelKey(label)]: { ...rowFor(label), ...patch } }));
  };

  const submit = async () => {
    const filled = pending.filter((l) => rowFor(l).start || rowFor(l).end);
    if (filled.length === 0) {
      setError('Enter the first and last day for at least one term, or choose Not now.');
      return;
    }
    for (const label of filled) {
      const { start, end } = rowFor(label);
      const problem = validateTermDates(start, end);
      if (problem) {
        setError(`${label}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const label of filled) {
        const { start, end } = rowFor(label);
        await save({ id: termIdForLabel(label), label, startDate: start, endDate: end });
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save those terms. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex overflow-y-auto bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="term-migration-title"
    >
      <div ref={dialogRef} tabIndex={-1} className="relative m-auto w-full max-w-md outline-none">
        <Card accent="none" opaque>
          <CardHeader>
            <CardTitle id="term-migration-title">When do your terms run?</CardTitle>
            <CardDescription>
              Terms now have a first and last day. Your courses keep everything they have; these{' '}
              {pending.length === 1 ? 'term needs its' : 'terms need their'} dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending.map((label, i) => (
              <fieldset key={label} className="space-y-2">
                <legend className="text-sm font-semibold text-foreground">{label}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor={`migrate-start-${i}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      First day of {label}
                    </label>
                    <input
                      id={`migrate-start-${i}`}
                      type="date"
                      value={rowFor(label).start}
                      onChange={(e) => setRow(label, { start: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={`migrate-end-${i}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Last day of {label}
                    </label>
                    <input
                      id={`migrate-end-${i}`}
                      type="date"
                      value={rowFor(label).end}
                      onChange={(e) => setRow(label, { end: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </fieldset>
            ))}
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <CardActionButton variant="solid" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Saving…' : 'Save dates'}
              </CardActionButton>
              <CardActionButton variant="ghost" onClick={finish} disabled={saving}>
                Not now
              </CardActionButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
