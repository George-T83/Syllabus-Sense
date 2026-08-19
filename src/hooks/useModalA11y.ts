'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wires Escape-to-close and a focus trap for a modal dialog: focus moves
 * into the dialog on open, Tab/Shift+Tab cycle only through elements inside
 * it, and focus returns to whatever triggered it on close. Without this,
 * keyboard/screen-reader users can tab straight out into the page behind a
 * modal that's still technically open.
 */
export function useModalA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables?.[0] ?? container)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !container) return;

      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  return containerRef;
}
