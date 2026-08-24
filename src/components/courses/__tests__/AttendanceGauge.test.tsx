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
      />
    );

    expect(screen.getByText('Attendance & Absence Allowance Gauge')).toBeDefined();
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
      />
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
      />
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
      />
    );

    const deleteBtn = screen.getByLabelText(/Delete absence on 2026-09-10/i);
    fireEvent.click(deleteBtn);

    expect(onDeleted).toHaveBeenCalledWith('1');
    expect(screen.queryByText('Missed train')).toBeNull();
  });
});
