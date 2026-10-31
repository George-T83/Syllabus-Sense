import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteCourseDialog } from '../DeleteCourseDialog';

const contents = { tasks: 12, contacts: 2, flashcards: 40, quizzes: 0 };

function setup(extra: Partial<React.ComponentProps<typeof DeleteCourseDialog>> = {}) {
  const props = {
    open: true,
    course: { code: 'CSCI 213', title: 'Data Structures' },
    contents,
    busy: null,
    onArchive: vi.fn(),
    onDeleteForever: vi.fn(),
    onClose: vi.fn(),
    ...extra,
  };
  render(<DeleteCourseDialog {...props} />);
  return props;
}

describe('DeleteCourseDialog', () => {
  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers Archive and Delete forever for the course, saying what each does to what it holds', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Archive or delete CSCI 213?' });
    expect(dialog.textContent).toContain('Data Structures');
    expect(dialog.textContent).toMatch(
      /Keeps everything, including 12 tasks, 2 contacts and 40 flashcards/,
    );
    expect(dialog.textContent).toMatch(
      /Removes the course and 12 tasks, 2 contacts and 40 flashcards/,
    );
    expect(dialog.textContent).toMatch(/can’t be undone|can't be undone/);
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeTruthy();
  });

  it('puts the focus on Archive, the preserving choice, not on Delete forever', () => {
    setup();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Archive' }));
  });

  it('archives, deletes forever and cancels from their own buttons only', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(p.onArchive).toHaveBeenCalledTimes(1);
    expect(p.onDeleteForever).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect(p.onDeleteForever).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const p = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed or double-submitted while an action is running', () => {
    const p = setup({ busy: 'archive' });
    expect((screen.getByRole('button', { name: 'Archiving…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Delete forever' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(p.onClose).not.toHaveBeenCalled();
  });
});
