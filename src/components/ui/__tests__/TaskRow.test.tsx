import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from '../TaskRow';

describe('TaskRow - trailing content and checkbox inside an href-wrapped row', () => {
  // Regression: the row renders as a Next.js <Link> whenever `href` is set,
  // so a nested interactive element (a trailing action button, or the
  // completion checkbox) must cancel the row's own navigation - otherwise
  // the click still fires its own handler AND the browser navigates the
  // anchor away right after (this broke the Calendar's Focus button, which
  // silently sent users to the task detail page instead of opening the
  // Pomodoro widget).

  it('prevents the row navigation when a trailing button is clicked', () => {
    const onTrailingClick = vi.fn();
    render(
      <TaskRow
        title="Read Chapter 5"
        href="/tasks/abc"
        trailing={<button onClick={onTrailingClick}>Focus</button>}
      />,
    );

    const button = screen.getByRole('button', { name: 'Focus' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(button, event);

    expect(onTrailingClick).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents the row navigation when the completion checkbox is clicked', () => {
    const onToggleComplete = vi.fn();
    render(
      <TaskRow title="Read Chapter 5" href="/tasks/abc" onToggleComplete={onToggleComplete} />,
    );

    const checkbox = screen.getByLabelText('Mark Read Chapter 5 complete');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(checkbox, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('still lets the row itself navigate when clicked outside the checkbox/trailing area', () => {
    render(
      <TaskRow
        title="Read Chapter 5"
        href="/tasks/abc"
        trailing={<button>Focus</button>}
        onToggleComplete={vi.fn()}
      />,
    );

    const link = screen.getByRole('link');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('applies the same guard on the touch variant', () => {
    const onTrailingClick = vi.fn();
    const onToggleComplete = vi.fn();
    render(
      <TaskRow
        title="Read Chapter 5"
        href="/tasks/abc"
        variant="touch"
        onToggleComplete={onToggleComplete}
        trailing={<button onClick={onTrailingClick}>Focus</button>}
      />,
    );

    const button = screen.getByRole('button', { name: 'Focus' });
    const buttonEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(button, buttonEvent);
    expect(onTrailingClick).toHaveBeenCalledTimes(1);
    expect(buttonEvent.defaultPrevented).toBe(true);

    const checkbox = screen.getByLabelText('Mark Read Chapter 5 complete');
    const checkboxEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(checkbox, checkboxEvent);
    expect(checkboxEvent.defaultPrevented).toBe(true);
  });
});
