import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttendanceGauge, AbsenceRecord } from '../AttendanceGauge';

const SAMPLE_ABSENCES: AbsenceRecord[] = [
  { id: '1', date: '2026-09-10', type: 'unexcused', reason: 'Missed train' },
  { id: '2', date: '2026-09-24', type: 'excused', reason: 'Flu' },
];

describe('AttendanceGauge (Item 48)', () => {
  it('renders circular gauge with unexcused absence count and syllabus policy card', () => {
    render(
      <AttendanceGauge
        courseCode="CS 301"
        courseTitle="Data Structures"
        maxAllowedAbsences={3}
        initialAbsences={SAMPLE_ABSENCES}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeDefined();
    expect(screen.getByRole('progressbar')).toBeDefined();
    expect(screen.getByTestId('absence-status-badge')).toBeDefined();
    expect(screen.getByText(/2 of 3 Absences Remaining/i)).toBeDefined();
  });

  it('updates status badge to warning and critical as unexcused absences increase', () => {
    const warningAbsences: AbsenceRecord[] = [
      { id: '1', date: '2026-09-10', type: 'unexcused' },
      { id: '2', date: '2026-09-12', type: 'unexcused' },
    ];

    render(
      <AttendanceGauge
        courseCode="CS 301"
        maxAllowedAbsences={3}
        initialAbsences={warningAbsences}
      />,
    );

    expect(screen.getByText(/Final Warning: 1 Absence Left/i)).toBeDefined();
  });

  it('logs a new absence via the modal dialog form', () => {
    const onLogged = vi.fn();
    render(
      <AttendanceGauge
        courseCode="CS 301"
        maxAllowedAbsences={3}
        initialAbsences={SAMPLE_ABSENCES}
        onAbsenceLogged={onLogged}
      />,
    );

    // Open modal
    fireEvent.click(screen.getByTestId('log-absence-open-btn'));

    // Fill form
    const reasonInput = screen.getByLabelText(/Reason or excuse/i);
    fireEvent.change(reasonInput, { target: { value: 'Overslept alarm' } });

    const submitBtn = screen.getByTestId('submit-absence-btn');
    fireEvent.click(submitBtn);

    expect(onLogged).toHaveBeenCalled();
    expect(screen.getByText('Overslept alarm')).toBeDefined();
  });

  it('deletes an absence when delete icon button is clicked', () => {
    const onDeleted = vi.fn();
    render(
      <AttendanceGauge
        courseCode="CS 301"
        maxAllowedAbsences={3}
        initialAbsences={SAMPLE_ABSENCES}
        onAbsenceDeleted={onDeleted}
      />,
    );

    const deleteBtn = screen.getByLabelText(/Delete absence on 2026-09-10/i);
    fireEvent.click(deleteBtn);

    expect(onDeleted).toHaveBeenCalledWith('1');
    expect(screen.queryByText('Missed train')).toBeNull();
  });

  it('never assumes a limit when no policy is on file', () => {
    render(<AttendanceGauge courseCode="CS 301" initialAbsences={SAMPLE_ABSENCES} />);
    expect(screen.getByTestId('absence-status-badge').textContent).toBe('No limit on file');
    expect(screen.getByText(/No attendance policy on file/)).toBeDefined();
    // No invented quote, limit or "you can miss N more" advice.
    expect(screen.queryByText(/Allowed Unexcused/)).toBeNull();
    expect(screen.queryByText(/can miss/)).toBeNull();
    expect(screen.queryByText(/incurs a 3% deduction/)).toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe(
      'Unexcused absences: 1, no limit on file',
    );
  });

  it('saves the policy the student enters from their syllabus', () => {
    const onPolicyChange = vi.fn();
    render(<AttendanceGauge courseCode="CS 301" onPolicyChange={onPolicyChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Add policy/ }));
    fireEvent.change(screen.getByLabelText(/Unexcused absences allowed/), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/What happens after that/), {
      target: { value: 'Final grade drops a third of a letter per absence.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
    expect(onPolicyChange).toHaveBeenCalledWith({
      allowedUnexcused: 2,
      penalty: 'Final grade drops a third of a letter per absence.',
    });
  });

  it("shows the entered policy in the student's words, with advice measured against it", () => {
    render(
      <AttendanceGauge
        courseCode="CS 301"
        maxAllowedAbsences={4}
        penaltyDescription="Final grade drops a third of a letter per absence."
        initialAbsences={SAMPLE_ABSENCES}
      />,
    );
    expect(screen.getByText('Final grade drops a third of a letter per absence.')).toBeDefined();
    expect(screen.getByText(/From your syllabus, as you entered it/)).toBeDefined();
    expect(screen.getByText(/you can miss 3 more classes before it applies/)).toBeDefined();
  });

  it('defaults a new absence to today, not a fixed date', () => {
    render(<AttendanceGauge courseCode="CS 301" />);
    fireEvent.click(screen.getByTestId('log-absence-open-btn'));
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect((screen.getByLabelText(/Date/i) as HTMLInputElement).value).toBe(today);
  });
});
