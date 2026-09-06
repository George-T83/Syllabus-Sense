'use client';

import { CardContent } from '@/components/ui/Card';

export interface DiscardConfirmCardProps {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Content shown by `useDirtyClose` in place of a form modal's normal body
 * when the user tries to close with unsaved changes. Rendered as a
 * replacement for the form inside the same `Card`, not stacked on top of
 * it - covering the form with an overlay left either a stray rectangle
 * (opaque) or the form itself dimmed/blurred out from underneath
 * (translucent); swapping content avoids both.
 */
export function DiscardConfirmCard({
  title,
  description,
  onCancel,
  onConfirm,
}: DiscardConfirmCardProps) {
  return (
    <CardContent className="space-y-4 pt-6">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          Discard
        </button>
      </div>
    </CardContent>
  );
}
