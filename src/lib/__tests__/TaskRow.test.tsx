import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskRow } from '@/components/ui/TaskRow';

describe('TaskRow', () => {
  it('renders the title and course code', () => {
    render(<TaskRow title="Recursion HW" courseCode="CSCI 213" />);
    expect(screen.getByText('Recursion HW')).toBeDefined();
    expect(screen.getByText('CSCI 213')).toBeDefined();
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

  it('colors the left edge from the course color, not priority', () => {
    const { container } = render(<TaskRow title="Colored edge" courseColor="bg-blue-500" />);
    expect((container.firstChild as HTMLElement).style.borderLeftColor).toBe('rgb(59, 130, 246)');
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
});
