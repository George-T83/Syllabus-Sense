'use client';

import { useState } from 'react';
import { ConfirmDeleteInline } from '@/components/ui/ConfirmDeleteInline';

export interface RemoveSampleDataButtonProps {
  onRemove: () => void | Promise<void>;
  removing?: boolean;
  className?: string;
}

/**
 * "Remove sample data" with a confirm step. Pill-style with a tinted
 * background like the other destructive row actions, and the shared inline
 * confirm pair.
 */
export function RemoveSampleDataButton({
  onRemove,
  removing = false,
  className,
}: RemoveSampleDataButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <ConfirmDeleteInline
        deleting={removing}
        size="lg"
        message="Remove all sample courses, tasks and contacts?"
        confirmLabel="Remove"
        confirmingLabel="Removing..."
        onConfirm={async () => {
          await onRemove();
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
        className={className}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`inline-flex items-center justify-center rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 ${className ?? ''}`.trim()}
    >
      Remove sample data
    </button>
  );
}
