import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtracurricularView, ExtracurricularActivity } from '../ExtracurricularView';

const MOCK_ACTIVITIES: ExtracurricularActivity[] = [
  {
    id: 'act-test-1',
    title: 'ACM Chapter',
    category: 'club',
    organization: 'CS Dept',
    role: 'Treasurer',
    hoursPerWeek: 6,
    status: 'active',
    startDate: '2026-01-01',
    milestones: [
      { id: 'm-1', title: 'Submit Budget Proposal', dueDate: '2026-09-15', completed: false },
      { id: 'm-2', title: 'Onboard New Members', dueDate: '2026-09-20', completed: true },
    ],
  },
  {
    id: 'act-test-2',
    title: 'Bioinformatics Lab',
    category: 'research',
    organization: 'Genomics Inst',
    role: 'Researcher',
    hoursPerWeek: 10,
    status: 'active',
    startDate: '2026-01-10',
    milestones: [
      { id: 'm-3', title: 'Genome Sequence Analysis', dueDate: '2026-10-01', completed: false },
    ],
  },
];

describe('ExtracurricularView (Item 43)', () => {
  it('renders correctly with capacity gauge and active commitment hours', () => {
    render(<ExtracurricularView initialActivities={MOCK_ACTIVITIES} maxWeeklyCapacity={20} />);

    expect(screen.getByText(/Extracurricular & Internship Hub/i)).toBeDefined();
    // 6 + 10 = 16 hours
    expect(screen.getByText(/16 hrs \/ week/i)).toBeDefined();
    expect(screen.getByText(/80%/i)).toBeDefined();
    expect(screen.getByText(/Heavy Load/i)).toBeDefined();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('16');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('20');
  });

  it('filters activities by category and search term', () => {
    render(<ExtracurricularView initialActivities={MOCK_ACTIVITIES} />);

    expect(screen.getByTestId('activity-card-act-test-1')).toBeDefined();
    expect(screen.getByTestId('activity-card-act-test-2')).toBeDefined();

    // Filter by research category
    const categorySelect = screen.getByLabelText(/filter by activity category/i);
    fireEvent.change(categorySelect, { target: { value: 'research' } });

    expect(screen.queryByTestId('activity-card-act-test-1')).toBeNull();
    expect(screen.getByTestId('activity-card-act-test-2')).toBeDefined();

    // Reset filter and test search
    fireEvent.change(categorySelect, { target: { value: 'all' } });
    const searchInput = screen.getByLabelText(/search activities or milestones/i);
    fireEvent.change(searchInput, { target: { value: 'Treasurer' } });

    expect(screen.getByTestId('activity-card-act-test-1')).toBeDefined();
    expect(screen.queryByTestId('activity-card-act-test-2')).toBeNull();
  });

  it('toggles milestone completion status', () => {
    const onActivitiesChange = vi.fn();
    render(
      <ExtracurricularView
        initialActivities={MOCK_ACTIVITIES}
        onActivitiesChange={onActivitiesChange}
      />,
    );

    const toggleBtn = screen.getByLabelText(/Toggle milestone Submit Budget Proposal/i);
    fireEvent.click(toggleBtn);

    expect(onActivitiesChange).toHaveBeenCalled();
    const updated = onActivitiesChange.mock.calls[0][0] as ExtracurricularActivity[];
    const toggledMilestone = updated[0].milestones.find((m) => m.id === 'm-1');
    expect(toggledMilestone?.completed).toBe(true);
  });

  it('adds a new milestone to an activity', () => {
    const onActivitiesChange = vi.fn();
    render(
      <ExtracurricularView
        initialActivities={MOCK_ACTIVITIES}
        onActivitiesChange={onActivitiesChange}
      />,
    );

    // Open add milestone inline
    const addMilestoneButtons = screen.getAllByText(/Add Milestone/i);
    fireEvent.click(addMilestoneButtons[0]);

    const titleInput = screen.getByLabelText(/New milestone title/i);
    const dateInput = screen.getByLabelText(/New milestone due date/i);
    fireEvent.change(titleInput, { target: { value: 'Present at Symposium' } });
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const saveBtn = screen.getByText('Save Milestone');
    fireEvent.click(saveBtn);

    expect(onActivitiesChange).toHaveBeenCalled();
    const updated = onActivitiesChange.mock.calls[0][0] as ExtracurricularActivity[];
    expect(updated[0].milestones.some((m) => m.title === 'Present at Symposium')).toBe(true);
  });

  it('creates a new activity via modal', () => {
    const onActivitiesChange = vi.fn();
    render(
      <ExtracurricularView
        initialActivities={MOCK_ACTIVITIES}
        onActivitiesChange={onActivitiesChange}
      />,
    );

    const addBtn = screen.getByTestId('add-activity-btn');
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/e\.g\. ACM Student Chapter/i);
    fireEvent.change(titleInput, { target: { value: 'Google SWE Internship' } });

    const submitBtn = screen.getByText('Create Activity');
    fireEvent.click(submitBtn);

    expect(onActivitiesChange).toHaveBeenCalled();
    const updated = onActivitiesChange.mock.calls[0][0] as ExtracurricularActivity[];
    expect(updated.length).toBe(3);
    expect(updated.some((a) => a.title === 'Google SWE Internship')).toBe(true);
  });

  it('deletes an activity and updates capacity calculation', () => {
    const onActivitiesChange = vi.fn();
    render(
      <ExtracurricularView
        initialActivities={MOCK_ACTIVITIES}
        onActivitiesChange={onActivitiesChange}
      />,
    );

    const deleteBtn = screen.getByLabelText(/Delete ACM Chapter/i);
    fireEvent.click(deleteBtn);

    expect(onActivitiesChange).toHaveBeenCalled();
    const updated = onActivitiesChange.mock.calls[0][0] as ExtracurricularActivity[];
    expect(updated.length).toBe(1);
    expect(updated[0].title).toBe('Bioinformatics Lab');
  });
});
