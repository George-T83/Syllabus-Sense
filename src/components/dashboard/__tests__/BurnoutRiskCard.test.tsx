import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { BurnoutRiskCard } from '../BurnoutRiskCard';
import type { ScheduleItem } from '@/types/schedule';
import type { MoodEntry } from '@/types/mood';

function renderWithAuth(items: ScheduleItem[], moodEntries: MoodEntry[]) {
  return render(
    <AuthProvider>
      <BurnoutRiskCard scheduleItems={items} moodEntries={moodEntries} />
    </AuthProvider>,
  );
}

function overdueItem(id: string, dueDate: string): ScheduleItem {
  return {
    id,
    courseId: 'course-1',
    title: 'Overdue thing',
    type: 'assignment',
    dueDate,
    completed: false,
  };
}

describe('BurnoutRiskCard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing when risk is low', () => {
    const { container } = renderWithAuth([], []);
    expect(container.firstChild).toBeNull();
  });

  it('renders a warning with contributing factors when risk is elevated', () => {
    const items = [
      overdueItem('a', '2000-01-01'),
      overdueItem('b', '2000-01-02'),
      overdueItem('c', '2000-01-03'),
    ];
    renderWithAuth(items, []);

    expect(screen.getByText('3 overdue items')).toBeDefined();
  });

  it('dismisses the card and keeps it hidden for that risk level', () => {
    const items = [
      overdueItem('a', '2000-01-01'),
      overdueItem('b', '2000-01-02'),
      overdueItem('c', '2000-01-03'),
    ];
    const { container } = renderWithAuth(items, []);

    const dismissBtn = screen.getByRole('button', { name: /dismiss this burnout warning/i });
    fireEvent.click(dismissBtn);

    expect(container.firstChild).toBeNull();
  });
});
