'use client';

import { useEffect } from 'react';

/**
 * Lightweight Escape-to-close for a dropdown/popover - deliberately not
 * useModalA11y: a popover (the notification bell, the mobile "More" menu)
 * doesn't lock body scroll or trap Tab focus inside itself the way a modal
 * dialog does, it just needs to dismiss on Escape like every other
 * transient overlay already does via its backdrop click.
 */
export function usePopoverA11y(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
}
