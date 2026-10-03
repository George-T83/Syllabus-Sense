export type ShortcutId = 'palette' | 'advisor' | 'timer' | 'shortcuts';

/**
 * True while the user is typing into something, where a bare-key shortcut
 * such as "?" must stay a character, not a command.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Matches by physical key (`code`) when the browser gives one, because on a
 * Mac Option+A types "å" and Option+P types "π", so `key` never matches. */
function isLetter(e: KeyboardEvent, letter: string): boolean {
  return e.code ? e.code === `Key${letter.toUpperCase()}` : e.key.toLowerCase() === letter;
}

/**
 * The app's keyboard shortcuts, defined once so the handlers, the on-screen
 * hints and the cheat sheet cannot drift apart.
 *
 * Ctrl/Cmd+P is deliberately NOT used: it is the browser's Print command.
 */
export function matchesShortcut(e: KeyboardEvent, id: ShortcutId): boolean {
  switch (id) {
    case 'palette':
      return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && isLetter(e, 'k');
    case 'advisor':
      return e.altKey && !e.metaKey && !e.ctrlKey && isLetter(e, 'a');
    case 'timer':
      return e.altKey && !e.metaKey && !e.ctrlKey && isLetter(e, 'p');
    case 'shortcuts':
      return e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);
  }
}

export interface ShortcutHint {
  id: ShortcutId;
  /** Key label with the platform's own modifier, e.g. "⌘K" is shown as "⌘+K". */
  keys: (platform: { mod: string; alt: string }) => string;
  label: string;
}

export const SHORTCUT_HINTS: ShortcutHint[] = [
  { id: 'palette', keys: ({ mod }) => `${mod}+K`, label: 'Open the command palette' },
  { id: 'advisor', keys: ({ alt }) => `${alt}+A`, label: 'Open the AI Advisor chat' },
  { id: 'timer', keys: ({ alt }) => `${alt}+P`, label: 'Show or hide the focus timer' },
  { id: 'shortcuts', keys: () => '?', label: 'Show this list' },
];
