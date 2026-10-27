'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { useModalA11y } from '@/hooks/useModalA11y';
import { TermForm } from '@/components/terms/TermForm';
import { useSaveTerm } from '@/components/terms/useSaveTerm';
import type { Term } from '@/types/term';

interface TermFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the stored term once it has been saved. */
  onSaved?: (term: Term) => void;
  /** Present when editing a stored term. */
  initialTerm?: Term;
  /** A label to start a new term from. */
  suggestedLabel?: string;
}

export function TermFormModal({
  open,
  onClose,
  onSaved,
  initialTerm,
  suggestedLabel,
}: TermFormModalProps) {
  const { state } = useAppState();
  const save = useSaveTerm();
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex overflow-y-auto bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="term-form-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative m-auto w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none" opaque>
          <CardHeader>
            <CardTitle id="term-form-title">{initialTerm ? 'Edit term' : 'New term'}</CardTitle>
            <CardDescription>
              {initialTerm
                ? 'Change the days this term runs. Its name stays as it is on your courses.'
                : 'A term runs from a first day to a last day. Confirm the dates or adjust them.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TermForm
              key={initialTerm?.id ?? 'new'}
              initialTerm={initialTerm}
              suggestedLabel={suggestedLabel}
              existingTerms={state.terms}
              onSave={async (term) => {
                await save(term);
                onSaved?.(term);
                onClose();
              }}
              onCancel={onClose}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
