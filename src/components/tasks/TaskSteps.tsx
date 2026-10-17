'use client';

import { useState, type FormEvent } from 'react';
import { RowActionButton } from '@/components/ui/RowActionButton';
import { CardActionButton } from '@/components/ui/CardAction';
import {
  MAX_STEPS,
  MAX_STEP_TITLE_LENGTH,
  addStep,
  removeStep,
  stepCounts,
  toggleStep,
} from '@/lib/tasks/steps';
import type { TaskStep } from '@/types/schedule';

/**
 * A task's checklist: the smaller pieces ("outline", "first draft", "cite
 * sources") a big assignment is made of. Ticking one moves the task's progress
 * for the student; the parent decides how that is saved.
 */
export function TaskSteps({
  steps,
  onChange,
  disabled,
}: {
  steps: TaskStep[] | undefined;
  onChange: (next: TaskStep[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const { done, total } = stepCounts(steps);
  const full = total >= MAX_STEPS;

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const next = addStep(steps, draft);
    if (!next) return;
    onChange(next);
    setDraft('');
  };

  return (
    <section aria-labelledby="task-steps-heading" className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="task-steps-heading" className="text-sm font-semibold text-foreground">
          Steps
        </h2>
        {total > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            {done} of {total} done
          </span>
        )}
      </div>

      {total > 0 && (
        <ul className="mt-3 space-y-1.5">
          {(steps ?? []).map((step) => (
            <li key={step.id} className="flex items-center gap-2">
              <label className="flex min-h-9 flex-1 cursor-pointer items-center gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={step.done}
                  disabled={disabled}
                  onChange={() => onChange(toggleStep(steps, step.id))}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <span className={step.done ? 'text-muted-foreground line-through' : undefined}>
                  {step.title}
                </span>
              </label>
              <RowActionButton
                tone="destructive"
                disabled={disabled}
                aria-label={`Remove step: ${step.title}`}
                onClick={() => onChange(removeStep(steps, step.id))}
              >
                Remove
              </RowActionButton>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_STEP_TITLE_LENGTH}
          disabled={disabled || full}
          aria-label="New step"
          placeholder={full ? `Up to ${MAX_STEPS} steps` : 'Add a step, e.g. "Outline"'}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
        <CardActionButton
          type="submit"
          variant="solid"
          disabled={disabled || full || !draft.trim()}
        >
          Add step
        </CardActionButton>
      </form>
    </section>
  );
}
