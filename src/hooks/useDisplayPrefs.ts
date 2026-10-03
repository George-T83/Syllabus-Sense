'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DISPLAY_PREFS_EVENT,
  readPillHidden,
  readTextSize,
  writePillHidden,
  writeTextSize,
  type PillId,
  type TextSize,
} from '@/lib/display/displayPrefs';

/** Re-reads `read` on mount (never during the server render, so hydration
 * always matches) and whenever a display preference changes in this tab or
 * another one. */
function useStored<T>(initial: T, read: () => T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sync = () => setValue(read());
    sync();
    window.addEventListener(DISPLAY_PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DISPLAY_PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [read]);
  return value;
}

/** Whether a floating button has been dismissed on this device. */
export function usePillHidden(id: PillId): [boolean, (hidden: boolean) => void] {
  const read = useCallback(() => readPillHidden(id), [id]);
  const hidden = useStored(false, read);
  const set = useCallback((next: boolean) => writePillHidden(id, next), [id]);
  return [hidden, set];
}

export function useTextSize(): [TextSize, (size: TextSize) => void] {
  const size = useStored<TextSize>('default', readTextSize);
  return [size, writeTextSize];
}
