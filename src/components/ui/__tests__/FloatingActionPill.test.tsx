import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingActionPill } from '../FloatingActionPill';

function renderPill(onDismiss?: () => void) {
  return render(
    <FloatingActionPill
      onClick={vi.fn()}
      ariaLabel="Open the AI Advisor"
      title="AI Advisor"
      positionClassName="bottom-4 right-4"
      colorClassName="bg-primary"
      icon={<svg aria-hidden="true" />}
      label="Advisor"
      onDismiss={onDismiss}
      dismissLabel="Hide the AI Advisor button"
    />,
  );
}

describe('FloatingActionPill dismiss button', () => {
  it('is reachable by its name and hides the pill when pressed', () => {
    const onDismiss = vi.fn();
    renderPill(onDismiss);
    fireEvent.click(screen.getByRole('button', { name: 'Hide the AI Advisor button' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has a touch-sized button around the small visible badge', () => {
    renderPill(vi.fn());
    const button = screen.getByRole('button', { name: 'Hide the AI Advisor button' });
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('w-9');
  });

  it('is absent when the caller does not offer dismissing', () => {
    renderPill();
    expect(screen.queryByRole('button', { name: /^Hide/ })).toBeNull();
  });
});
