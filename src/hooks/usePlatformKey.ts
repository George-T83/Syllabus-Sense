'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the platform-appropriate modifier key label.
 * - Mac  → "⌘"  (Command)
 * - Win / Linux → "Ctrl"
 *
 * Defaults to "Ctrl" on the server (SSR) to avoid hydration mismatches;
 * updates after first client paint.
 */
export function usePlatformKey(): string {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent),
    );
  }, []);

  return isMac ? '⌘' : 'Ctrl';
}

/** The platform's modifier labels: ⌘ and ⌥ on a Mac, Ctrl and Alt elsewhere. */
export function usePlatform(): { mod: string; alt: string } {
  const mod = usePlatformKey();
  return { mod, alt: mod === '⌘' ? '⌥' : 'Alt' };
}
