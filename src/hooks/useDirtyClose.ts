'use client';

import { useState } from 'react';

/**
 * Guards a form modal's close path (backdrop click, Escape, a Cancel button)
 * behind a "discard unsaved changes?" confirmation whenever the current
 * values have actually diverged from the snapshot taken when the form
 * opened. Closing after a successful submit should call the modal's own
 * `onClose` directly, bypassing this - a save is never a discard.
 */
export function useDirtyClose<T>(current: T, baseline: T, onClose: () => void) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const isDirty = JSON.stringify(current) !== JSON.stringify(baseline);

  const requestClose = () => {
    if (isDirty) {
      setConfirmingDiscard(true);
    } else {
      onClose();
    }
  };

  const confirmDiscard = () => {
    setConfirmingDiscard(false);
    onClose();
  };

  const cancelDiscard = () => setConfirmingDiscard(false);

  return { requestClose, confirmingDiscard, confirmDiscard, cancelDiscard, isDirty };
}
