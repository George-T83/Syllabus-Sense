import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { useUndoToast } from '../useUndoToast';

function Harness({ restore }: { restore: () => Promise<void> }) {
  const showUndo = useUndoToast();
  return (
    <button onClick={() => showUndo('Task deleted', '"PS1" was removed.', restore)}>del</button>
  );
}

function setup(restore: () => Promise<void>) {
  render(
    <ToastProvider>
      <Harness restore={restore} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText('del'));
}

describe('useUndoToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows what was deleted with an Undo button', () => {
    setup(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByText('Task deleted')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('restores the item once, and closes the toast, when Undo is pressed', () => {
    const restore = vi.fn().mockResolvedValue(undefined);
    setup(restore);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(restore).toHaveBeenCalledOnce();
    expect(screen.queryByText('Task deleted')).toBeNull();
  });

  it('stays long enough to reach (8s) and then goes away', () => {
    setup(vi.fn().mockResolvedValue(undefined));
    act(() => vi.advanceTimersByTime(7500));
    expect(screen.getByText('Task deleted')).toBeTruthy();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByText('Task deleted')).toBeNull();
  });

  it('says so when the restore fails', async () => {
    setup(vi.fn().mockRejectedValue(new Error('offline')));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(screen.getByText('Could not undo that')).toBeTruthy();
    expect(screen.getByText('offline')).toBeTruthy();
  });
});
