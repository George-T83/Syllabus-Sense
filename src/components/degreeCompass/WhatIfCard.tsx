'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowActionButton } from '@/components/ui/RowActionButton';
import {
  MAX_PLANNED_TERMS,
  planTerms,
  projectWhatIf,
  type HypotheticalCourse,
} from '@/lib/degreeCompass/whatIf';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

const DEFAULT_MAX_CREDITS_PER_TERM = 15;

function credits(n: number): string {
  return `${n} ${n === 1 ? 'credit' : 'credits'}`;
}

function terms(n: number): string {
  return `${n} ${n === 1 ? 'term' : 'terms'}`;
}

function FlaskIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"
      />
    </svg>
  );
}

export interface WhatIfCardProps {
  categories: DegreeRequirementCategory[];
  courses: DegreeCourse[];
}

/**
 * "Try a plan": add courses you might take next term (credits + the
 * requirement they count toward) and see where that lands you, then see the
 * fastest way through what is left for a max credits per term. Everything
 * here is component state - nothing is saved or written to the course list.
 * It works in credits per requirement, not specific courses or prerequisites.
 */
export function WhatIfCard({ categories, courses }: WhatIfCardProps) {
  const [entries, setEntries] = useState<HypotheticalCourse[]>([]);
  const [creditsInput, setCreditsInput] = useState('3');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [maxInput, setMaxInput] = useState(String(DEFAULT_MAX_CREDITS_PER_TERM));
  const nextId = useRef(1);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  // The select falls back to the first category if the chosen one was
  // removed from the profile while this card was open.
  const selectedCategoryId = categoryNameById.has(categoryId)
    ? categoryId
    : (categories[0]?.id ?? '');

  const result = useMemo(
    () => projectWhatIf(categories, courses, entries),
    [categories, courses, entries],
  );
  const maxCredits = maxInput.trim() === '' ? Number.NaN : Number(maxInput);
  const plan = useMemo(
    () => planTerms(result.shortfallsAfter, maxCredits),
    [result.shortfallsAfter, maxCredits],
  );

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const value = creditsInput.trim() === '' ? Number.NaN : Number(creditsInput);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter a number of credits above 0.');
      return;
    }
    if (!selectedCategoryId) {
      setFormError('Pick a requirement it counts toward.');
      return;
    }
    setFormError(null);
    const id = String(nextId.current++);
    setEntries((prev) => [...prev, { id, credits: value, categoryId: selectedCategoryId }]);
  };

  const hasEntries = entries.length > 0;
  const changed = result.counted.length > 0;
  const { before, after } = result;
  const gainedParts: string[] = [];
  if (result.creditsGained > 0) gainedParts.push(`+${result.creditsGained} toward requirements`);
  if (result.extraGained > 0) gainedParts.push(`+${result.extraGained} extra past a requirement`);

  return (
    <Card className="rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Try a plan</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Not saved
          </span>
        </div>
        {hasEntries && (
          <CardActionButton variant="ghost" onClick={() => setEntries([])}>
            Clear all
          </CardActionButton>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Add courses you might take next term to see where you would land. These are not saved and do
        not change your course list. This works in credits per requirement, not specific courses or
        prerequisites.
      </p>

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_1fr_auto] sm:items-end"
        noValidate
      >
        <div className="space-y-1.5">
          <label htmlFor="what-if-credits" className="text-xs font-medium text-foreground">
            Credits
          </label>
          <input
            id="what-if-credits"
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            value={creditsInput}
            onChange={(e) => setCreditsInput(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="what-if-category" className="text-xs font-medium text-foreground">
            Counts toward
          </label>
          <select
            id="what-if-category"
            value={selectedCategoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <CardActionButton type="submit" variant="solid" withPlus disabled={categories.length === 0}>
          Add to plan
        </CardActionButton>
      </form>
      {formError && (
        <p role="alert" className="text-xs text-load-critical">
          {formError}
        </p>
      )}

      {hasEntries ? (
        <ul aria-label="Courses in this plan" className="flex flex-col gap-2">
          {entries.map((entry) => {
            const name = categoryNameById.get(entry.categoryId);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground"
              >
                <div className="min-w-0">
                  <span className="font-medium">{entry.credits} cr</span>
                  <span className="text-muted-foreground"> · {name ?? 'Unknown requirement'}</span>
                  {!name && <span className="ml-2 text-xs text-load-medium">Not counted</span>}
                </div>
                <RowActionButton
                  tone="destructive"
                  aria-label={`Remove ${entry.credits} cr ${name ?? 'unknown requirement'} from this plan`}
                  onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                >
                  Remove
                </RowActionButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<FlaskIcon />}
          title="No courses in this plan yet"
          description='Add a credit amount and a requirement above to see "what if".'
        />
      )}

      {changed && (
        <section aria-label="Where you would land" aria-live="polite" className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              If you take these
            </p>
            <p className="mt-1 text-sm text-foreground">
              <span className="tabular-nums text-muted-foreground">
                {before.creditsCompleted + before.creditsInProgress} / {before.creditsRequired} cr
              </span>
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> becomes </span>
              <span className="font-semibold tabular-nums">
                {after.creditsCompleted + after.creditsInProgress} / {after.creditsRequired} cr
              </span>
              {gainedParts.length > 0 && (
                <span className="text-muted-foreground"> ({gainedParts.join(', ')})</span>
              )}
            </p>
            {result.completeAfter && (
              <p className="mt-1 text-xs text-load-low">Every requirement would be met.</p>
            )}
          </div>
          <ul className="space-y-1.5">
            {result.categories.map((c) => {
              const moved = c.earnedAfter !== c.earnedBefore || c.extraAfter !== c.extraBefore;
              return (
                <li key={c.category.id} className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={cn(
                      'font-medium',
                      moved ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {c.category.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {c.earnedBefore} / {c.category.creditsRequired} cr
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> becomes </span>
                    <span className={cn(moved && 'font-semibold text-foreground')}>
                      {c.earnedAfter} / {c.category.creditsRequired} cr
                    </span>
                    {c.extraAfter > c.extraBefore && ` (+${c.extraAfter} extra)`}
                  </span>
                </li>
              );
            })}
          </ul>
          {result.extraGained > 0 && (
            <p className="text-xs text-muted-foreground">
              Credits past a requirement are real but do not count twice or cover another
              requirement.
            </p>
          )}
        </section>
      )}

      <section aria-label="Fastest route" className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Fastest route
            </p>
            <p className="mt-1 text-sm text-foreground" aria-live="polite">
              {plan.problem === 'invalid-max'
                ? 'Enter a max credits per term above 0.'
                : plan.problem === 'too-many-terms'
                  ? `That would take more than ${MAX_PLANNED_TERMS} terms. Try a higher limit.`
                  : plan.terms.length === 0
                    ? 'Nothing left to schedule: every requirement is covered by your plan.'
                    : `${terms(plan.terms.length)} to cover the remaining ${credits(plan.totalCredits)}${
                        changed ? ', after the courses above' : ''
                      }.`}
            </p>
          </div>
          <div className="w-36 space-y-1.5">
            <label htmlFor="what-if-max" className="text-xs font-medium text-foreground">
              Max credits per term
            </label>
            <input
              id="what-if-max"
              type="number"
              min={1}
              step={0.5}
              inputMode="decimal"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {plan.terms.length > 0 && (
          <ol aria-label="Remaining terms" className="space-y-1.5">
            {plan.terms.map((term) => (
              <li
                key={term.number}
                className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
              >
                <span className="font-semibold">Term {term.number}</span>
                <span className="text-muted-foreground"> · {term.credits} cr: </span>
                {term.items.map((item) => `${item.name} ${item.credits}`).join(', ')}
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          Counts the credits your plan does not cover yet, by requirement. It does not pick courses
          or check prerequisites, and a real course cannot be split across terms.
        </p>
      </section>
    </Card>
  );
}
