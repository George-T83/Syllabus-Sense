import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';

/** Long enough to notice the toast, read it and reach the button. */
const UNDO_WINDOW_MS = 8000;

/**
 * "Deleted - Undo". Call once the delete has gone through; `restore` puts the
 * thing back, and a failure to do so is reported instead of swallowed.
 */
export function useUndoToast() {
  const { showToast, showError } = useToast();

  return useCallback(
    (title: string, message: string, restore: () => Promise<void>) =>
      showToast({
        type: 'success',
        title,
        message,
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onAction: () => {
            restore().catch((err) =>
              showError('Could not undo that', err instanceof Error ? err.message : undefined),
            );
          },
        },
      }),
    [showToast, showError],
  );
}
