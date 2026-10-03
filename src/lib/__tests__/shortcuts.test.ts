import { describe, it, expect } from 'vitest';
import { matchesShortcut, isTypingTarget } from '../shortcuts';

const key = (init: KeyboardEventInit & { target?: EventTarget }) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, ...init });
  if (init.target) Object.defineProperty(e, 'target', { value: init.target });
  return e;
};

describe('matchesShortcut', () => {
  it('palette: Ctrl+K and Cmd+K, nothing else', () => {
    expect(matchesShortcut(key({ key: 'k', code: 'KeyK', ctrlKey: true }), 'palette')).toBe(true);
    expect(matchesShortcut(key({ key: 'k', code: 'KeyK', metaKey: true }), 'palette')).toBe(true);
    expect(matchesShortcut(key({ key: 'k', code: 'KeyK' }), 'palette')).toBe(false);
    expect(
      matchesShortcut(key({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }), 'palette'),
    ).toBe(false);
  });

  it('never claims Ctrl/Cmd+P, which is Print', () => {
    for (const id of ['palette', 'advisor', 'timer', 'shortcuts'] as const) {
      expect(matchesShortcut(key({ key: 'p', code: 'KeyP', ctrlKey: true }), id)).toBe(false);
      expect(matchesShortcut(key({ key: 'p', code: 'KeyP', metaKey: true }), id)).toBe(false);
    }
  });

  it('advisor and timer: Alt+A and Alt+P, also when a Mac types å and π', () => {
    expect(matchesShortcut(key({ key: 'a', code: 'KeyA', altKey: true }), 'advisor')).toBe(true);
    expect(matchesShortcut(key({ key: 'å', code: 'KeyA', altKey: true }), 'advisor')).toBe(true);
    expect(matchesShortcut(key({ key: 'π', code: 'KeyP', altKey: true }), 'timer')).toBe(true);
    expect(matchesShortcut(key({ key: 'a', code: 'KeyA' }), 'advisor')).toBe(false);
    expect(
      matchesShortcut(key({ key: 'a', code: 'KeyA', altKey: true, ctrlKey: true }), 'advisor'),
    ).toBe(false);
  });

  it('falls back to the key when an event has no code', () => {
    expect(matchesShortcut(key({ key: 'a', altKey: true }), 'advisor')).toBe(true);
  });

  it('shortcuts: "?" opens the list, but never while typing in a field', () => {
    expect(matchesShortcut(key({ key: '?', shiftKey: true }), 'shortcuts')).toBe(true);
    const input = document.createElement('input');
    expect(matchesShortcut(key({ key: '?', target: input }), 'shortcuts')).toBe(false);
    const area = document.createElement('textarea');
    expect(matchesShortcut(key({ key: '?', target: area }), 'shortcuts')).toBe(false);
    expect(matchesShortcut(key({ key: '?', ctrlKey: true }), 'shortcuts')).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('is true for inputs, textareas, selects and editable elements only', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
