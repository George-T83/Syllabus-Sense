import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskRow } from '@/components/ui/TaskRow';

describe('TaskRow', () => {
  it('renders the title and a course code + type meta line', () => {
    render(<TaskRow title="Recursion HW" courseCode="CSCI 213" />);
    expect(screen.getByText('Recursion HW')).toBeDefined();
    // Default type is 'assignment' - the card variant always appends it.
    expect(screen.getByText('CSCI 213 · Assignment')).toBeDefined();
  });

  it('shows a strikethrough style when completed', () => {
    render(<TaskRow title="Done Task" completed />);
    expect(screen.getByText('Done Task').className).toContain('line-through');
  });

  it('only renders a checkbox when onToggleComplete is provided', () => {
    const { rerender } = render(<TaskRow title="No checkbox" />);
    expect(screen.queryByRole('checkbox')).toBeNull();

    rerender(<TaskRow title="Has checkbox" onToggleComplete={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeDefined();
  });

  it('calls onToggleComplete when the checkbox is toggled', () => {
    const onToggle = vi.fn();
    render(<TaskRow title="Toggle me" onToggleComplete={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('washes the card background with the course color', () => {
    const { container } = render(<TaskRow title="Colored card" courseColor="bg-blue-500" />);
    // courseWash resolves the blue-500 preset to its hex (#3b82f6) with a
    // faint alpha; jsdom normalizes the 8-digit hex it's given into rgba.
    expect((container.firstChild as HTMLElement).style.backgroundColor).toBe(
      'rgba(59, 130, 246, 0.07)',
    );
  });

  it('shows a high-priority indicator only for incomplete high-priority tasks', () => {
    render(<TaskRow title="High" priority="high" />);
    expect(screen.getByLabelText('High priority')).toBeDefined();

    const { container } = render(<TaskRow title="Low" priority="low" />);
    expect(container.querySelector('[aria-label="High priority"]')).toBeNull();
  });

  it('renders trailing content when provided', () => {
    render(<TaskRow title="With trailing" trailing={<span>Due Sep 1</span>} />);
    expect(screen.getByText('Due Sep 1')).toBeDefined();
  });

  it('shows the course icon badge, defaulting to the book glyph', () => {
    const { container } = render(<TaskRow title="Icon default" />);
    // The default 'book' glyph is a single <path> - no other primitives.
    expect(container.querySelector('svg rect, svg circle')).toBeNull();
  });

  it('renders a different glyph when courseIcon is set', () => {
    const { container } = render(<TaskRow title="Icon set" courseIcon="calculator" />);
    // The 'calculator' glyph is built from a <rect> plus dot <circle>s.
    expect(container.querySelector('svg rect')).not.toBeNull();
  });
});
