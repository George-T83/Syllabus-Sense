import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from '@/components/ui/Toast';

function TestConsumer() {
  const { showSuccess, showError, showInfo, showWarning, removeToast, toasts } = useToast();

  return (
    <div>
      <button onClick={() => showSuccess('Success Title', 'Success Detail')}>
        Trigger Success
      </button>
      <button onClick={() => showError('Error Title', 'Error Detail')}>Trigger Error</button>
      <button onClick={() => showInfo('Info Title')}>Trigger Info</button>
      <button onClick={() => showWarning('Warning Title')}>Trigger Warning</button>
      {toasts.map((t) => (
        <button key={t.id} onClick={() => removeToast(t.id)}>
          Dismiss {t.id}
        </button>
      ))}
    </div>
  );
}

describe('Toast Component & Hook Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws error when useToast is used outside ToastProvider', () => {
    // Suppress console.error during expected thrown error test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useToast must be used within a ToastProvider');
    spy.mockRestore();
  });

  it('renders success toast with title and message', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Trigger Success'));

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Success Title')).toBeDefined();
    expect(screen.getByText('Success Detail')).toBeDefined();
  });

  it('renders error, info, and warning toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Trigger Error'));
    expect(screen.getByText('Error Title')).toBeDefined();

    fireEvent.click(screen.getByText('Trigger Info'));
    expect(screen.getByText('Info Title')).toBeDefined();

    fireEvent.click(screen.getByText('Trigger Warning'));
    expect(screen.getByText('Warning Title')).toBeDefined();
  });

  it('auto-dismisses toast after duration', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Trigger Success'));
    expect(screen.getByText('Success Title')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Success Title')).toBeNull();
  });

  it('allows manual dismissal via close button', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Trigger Success'));
    expect(screen.getByText('Success Title')).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: /close notification/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Success Title')).toBeNull();
  });
});
