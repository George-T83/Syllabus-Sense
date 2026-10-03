import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { NowHeroCard } from '@/components/dashboard/NowHeroCard';
import { FOCUS_TASK_EVENT } from '@/lib/focus/focusTaskEvent';
import type { BriefingItem } from '@/lib/dashboard/weekBriefing';

afterEach(cleanup);

const entry: BriefingItem = {
  item: {
    id: 't1',
    courseId: 'c1',
    title: 'Problem Set 5',
    type: 'assignment',
    dueDate: '2026-09-23',
    completed: false,
  },
  course: { id: 'c1', code: 'CSCI 213', title: 'Data Structures' },
  daysUntilDue: 0,
  weight: 6,
  hoursLeft: 5,
};

const noop = () => {};

describe('NowHeroCard', () => {
  it('names the urgent task and offers focus, open and done', () => {
    const onMarkDone = vi.fn();
    const onFocus = vi.fn();
    window.addEventListener(FOCUS_TASK_EVENT, onFocus);
    render(
      <NowHeroCard
        hero={{ kind: 'urgent', entry, others: 3 }}
        onMarkDone={onMarkDone}
        onUploadSyllabus={noop}
        onAddTask={noop}
      />,
    );
    expect(screen.getByText('Do this now')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Problem Set 5' })).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('6% of your grade')).toBeDefined();
    expect(screen.getByRole('link', { name: /Open task/ }).getAttribute('href')).toBe('/tasks/t1');

    fireEvent.click(screen.getByRole('button', { name: 'Start a focus session' }));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect((onFocus.mock.calls[0][0] as CustomEvent).detail).toEqual({ taskId: 't1' });
    window.removeEventListener(FOCUS_TASK_EVENT, onFocus);

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(onMarkDone).toHaveBeenCalledWith('t1');
    expect(screen.getByText('+3 more this week')).toBeDefined();
  });

  it('says "Next up" when nothing is due yet, and hides Mark done when signed out', () => {
    render(
      <NowHeroCard
        hero={{ kind: 'next', entry: { ...entry, daysUntilDue: 3 }, others: 0 }}
        onUploadSyllabus={noop}
        onAddTask={noop}
      />,
    );
    expect(screen.getByText('Next up')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull();
    expect(screen.queryByText(/more this week/)).toBeNull();
  });

  it('points at flashcards when only cards are due', () => {
    render(
      <NowHeroCard
        hero={{ kind: 'cards', dueCards: 1 }}
        onUploadSyllabus={noop}
        onAddTask={noop}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Review 1 card' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Start reviewing/ }).getAttribute('href')).toBe(
      '/flashcards',
    );
  });

  it('leads with the syllabus upload only when all clear', () => {
    const onUpload = vi.fn();
    const onAdd = vi.fn();
    render(<NowHeroCard hero={{ kind: 'clear' }} onUploadSyllabus={onUpload} onAddTask={onAdd} />);
    expect(screen.getByRole('heading', { name: 'Nothing needs you right now' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Autofill from Syllabus/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add a task/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
