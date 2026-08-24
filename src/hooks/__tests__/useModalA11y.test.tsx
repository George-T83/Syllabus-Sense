import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useModalA11y } from '../useModalA11y';

interface TestModalProps {
  open: boolean;
  onClose: () => void;
  hasInputs?: boolean;
}

function TestModal({ open, onClose, hasInputs = true }: TestModalProps) {
  const modalRef = useModalA11y<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <div data-testid="modal-container" ref={modalRef}>
      <h2>Modal Title</h2>
      {hasInputs ? (
        <>
          <button data-testid="first-btn">First Button</button>
          <input data-testid="middle-input" placeholder="Middle input" />
          <button data-testid="last-btn">Last Button</button>
        </>
      ) : (
        <p>No focusable children</p>
      )}
    </div>
  );
}

describe('useModalA11y', () => {
  beforeEach(() => {
    document.body.style.overflow = 'auto';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('locks body scroll when open and restores it when closed', () => {
    document.body.style.overflow = 'scroll';
    const onClose = vi.fn();
    const { rerender } = render(<TestModal open={true} onClose={onClose} />);

    expect(document.body.style.overflow).toBe('hidden');

    rerender(<TestModal open={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('moves initial focus to the first focusable element', () => {
    const onClose = vi.fn();
    render(<TestModal open={true} onClose={onClose} />);

    const firstBtn = screen.getByTestId('first-btn');
    expect(document.activeElement).toBe(firstBtn);
  });

  it('moves initial focus to the container with tabIndex=-1 if no focusable children exist', () => {
    const onClose = vi.fn();
    render(<TestModal open={true} onClose={onClose} hasInputs={false} />);

    const container = screen.getByTestId('modal-container');
    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(container);
  });

  it('traps focus: Tab on last element cycles back to first element', () => {
    const onClose = vi.fn();
    render(<TestModal open={true} onClose={onClose} />);

    const firstBtn = screen.getByTestId('first-btn');
    const lastBtn = screen.getByTestId('last-btn');

    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(firstBtn);
  });

  it('traps focus: Shift+Tab on first element cycles back to last element', () => {
    const onClose = vi.fn();
    render(<TestModal open={true} onClose={onClose} />);

    const firstBtn = screen.getByTestId('first-btn');
    const lastBtn = screen.getByTestId('last-btn');

    firstBtn.focus();
    expect(document.activeElement).toBe(firstBtn);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
  });

  it('traps focus: Shift+Tab on container itself cycles to last element', () => {
    const onClose = vi.fn();
    render(<TestModal open={true} onClose={onClose} />);

    const container = screen.getByTestId('modal-container');
    const lastBtn = screen.getByTestId('last-btn');

    container.focus();
    expect(document.activeElement).toBe(container);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<TestModal open={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to previous trigger element upon closing', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open Modal';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const onClose = vi.fn();
    const { rerender } = render(<TestModal open={true} onClose={onClose} />);

    expect(document.activeElement).not.toBe(trigger);

    rerender(<TestModal open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
});
