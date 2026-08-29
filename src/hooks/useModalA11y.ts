'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wires Escape-to-close, body scroll locking, and a hardened focus trap for modal dialogs:
 * - Locks body scroll (overflow: hidden) while open and restores previous overflow on close
 * - Sets tabIndex={-1} on the modal container if not already present
 * - Moves initial focus to the first focusable element or container
 * - Prevents tabbing outside the dialog boundary (Shift+Tab from first/container cycles to last, Tab from last cycles to first)
 * - Restores focus to the trigger element when closed
 * - Cleanly dismisses on Escape key
 */
export function useModalA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    // 1. Lock background body scrolling
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const container = containerRef.current;
    if (container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }

    // 2. Helper to get valid focusable elements
    const getFocusables = (): HTMLElement[] => {
      if (!container) return [];
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      return nodes.filter(
        (node) =>
          !node.hasAttribute('disabled') &&
          node.getAttribute('aria-hidden') !== 'true' &&
          node.tabIndex !== -1,
      );
    };

    // 3. Initial focus: focus first focusable child, or container
    const focusables = getFocusables();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else if (container) {
      container.focus();
    }

    // 4. Keydown handler for Escape and Tab focus trapping
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !container) return;

      const nodes = getFocusables();
      if (nodes.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab: cycling backwards
        if (active === first || active === container || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: cycling forwards
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  return containerRef;
}
