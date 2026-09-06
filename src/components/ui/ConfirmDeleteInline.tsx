'use client';

/**
 * The inline "Confirm / Cancel" pair shown in place of a Delete button once
 * it's tapped - previously hand-copied at every delete site (Materials,
 * Learning Objectives, Degree Compass courses, syllabus uploads, flashcard
 * decks, quizzes) with only the size varying between them.
 */
export interface ConfirmDeleteInlineProps {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** `sm` (px-2.5 py-1) matches row-level list items; `md` (min-h-[36px]
   * px-3) matches card-footer action rows; `lg` (px-3 py-1.5) matches
   * header-level actions like a whole-course delete. */
  size?: 'sm' | 'md' | 'lg';
  confirmLabel?: string;
  confirmingLabel?: string;
  className?: string;
  /** Optional confirmation copy shown before the buttons, e.g. "Delete
   * course and its tasks?" - most call sites rely on the Confirm/Cancel
   * wording alone and leave this unset. */
  message?: string;
}

const SIZE_CLASS = {
  sm: 'px-2.5 py-1',
  md: 'min-h-[36px] px-3',
  lg: 'px-3 py-1.5',
} as const;

export function ConfirmDeleteInline({
  deleting,
  onConfirm,
  onCancel,
  size = 'sm',
  confirmLabel = 'Confirm',
  confirmingLabel = 'Deleting…',
  className = '',
  message,
}: ConfirmDeleteInlineProps) {
  const sizeClass = SIZE_CLASS[size];
  return (
    <div className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${className}`.trim()}>
      {message && <span className="text-muted-foreground">{message}</span>}
      <button
        type="button"
        onClick={onConfirm}
        disabled={deleting}
        className={`inline-flex items-center justify-center rounded-full bg-destructive/10 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass}`}
      >
        {deleting ? confirmingLabel : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={deleting}
        className={`inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass}`}
      >
        Cancel
      </button>
    </div>
  );
}
