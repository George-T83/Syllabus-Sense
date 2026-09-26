import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CourseStandingStrip } from '../CourseStanding';
import type { ScheduleItem } from '@/types/schedule';

const item = (o: Partial<ScheduleItem> & { id: string }): ScheduleItem => ({
  courseId: 'cs',
  title: o.id,
  type: 'assignment',
  dueDate: '2026-09-01',
  completed: true,
  ...o,
});

describe('CourseStandingStrip', () => {
  it('shows the grade so far and how much of the final grade it covers', () => {
    const onOpen = vi.fn();
    render(
      <CourseStandingStrip
        onOpenCalculator={onOpen}
        items={[
          item({ id: 'hw', gradeWeight: 10, earnedScore: 92 }),
          item({ id: 'mid', gradeWeight: 25, earnedScore: 78 }),
          item({ id: 'final', gradeWeight: 40, completed: false }),
        ]}
      />,
    );
    expect(screen.getByText('82%')).toBeTruthy();
    expect(screen.getByText('B-')).toBeTruthy();
    expect(
      screen.getByText('From 2 graded items, 35% of your final grade. 65% is still ahead.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /What do I need/ }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('explains how to get a grade when nothing is scored yet', () => {
    render(
      <CourseStandingStrip
        onOpenCalculator={vi.fn()}
        items={[item({ id: 'a', gradeWeight: 20 })]}
      />,
    );
    expect(screen.getByText(/No grades yet/)).toBeTruthy();
  });

  it('shows nothing for a course without grade weights', () => {
    const { container } = render(
      <CourseStandingStrip onOpenCalculator={vi.fn()} items={[item({ id: 'a' })]} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
