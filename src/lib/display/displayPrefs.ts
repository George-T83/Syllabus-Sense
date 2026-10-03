/**
 * Per-device display preferences: how large text is, and which floating
 * buttons are showing. Like the theme, these live in localStorage rather than
 * the account - a phone and a desktop reasonably want different answers - and
 * are applied before first paint by the inline script in app/layout.tsx.
 */

export type TextSize = 'default' | 'large' | 'larger';

export const TEXT_SIZE_KEY = 'syllabus-sense-text-size';

export const TEXT_SIZE_OPTIONS: ReadonlyArray<{
  value: TextSize;
  label: string;
  /** Root font size as a share of the browser default; every rem scales with it. */
  percent: number;
}> = [
  { value: 'default', label: 'Default', percent: 100 },
  { value: 'large', label: 'Large', percent: 112.5 },
  { value: 'larger', label: 'Larger', percent: 125 },
];

export type PillId = 'advisor' | 'focus';

export const PILL_LABELS: Record<PillId, string> = {
  advisor: 'AI Advisor',
  focus: 'Focus Timer',
};

const pillKey = (id: PillId) => `syllabus-sense-pill-hidden:${id}`;

/** Fired on this window whenever a display preference changes, so every
 * mounted consumer (the pills, the sidebar, the Profile controls) updates at
 * once. The native `storage` event only reaches other tabs. */
export const DISPLAY_PREFS_EVENT = 'syllabus-sense:display-prefs';

function isTextSize(v: unknown): v is TextSize {
  return v === 'default' || v === 'large' || v === 'larger';
}

export function readTextSize(): TextSize {
  try {
    const v = window.localStorage.getItem(TEXT_SIZE_KEY);
    return isTextSize(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

/** Sets the attribute globals.css keys the root font size off. */
export function applyTextSize(size: TextSize): void {
  if (size === 'default') document.documentElement.removeAttribute('data-text-size');
  else document.documentElement.setAttribute('data-text-size', size);
}

export function writeTextSize(size: TextSize): void {
  try {
    window.localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {
    // Private browsing: the change still applies for this page view.
  }
  applyTextSize(size);
  window.dispatchEvent(new Event(DISPLAY_PREFS_EVENT));
}

export function readPillHidden(id: PillId): boolean {
  try {
    return window.localStorage.getItem(pillKey(id)) === 'true';
  } catch {
    return false;
  }
}

export function writePillHidden(id: PillId, hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(pillKey(id), 'true');
    else window.localStorage.removeItem(pillKey(id));
  } catch {
    // Private browsing: hidden for this page view only.
  }
  window.dispatchEvent(new Event(DISPLAY_PREFS_EVENT));
}
