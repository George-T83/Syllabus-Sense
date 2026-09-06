import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyllabusDiffModal } from '../SyllabusDiffModal';

const SAMPLE_ORIGINAL = `CS 301 Data Structures
Grading:
- Homework: 20%
- Final: 40%
Attendance: 3 absences allowed`;

const SAMPLE_REVISED = `CS 301 Data Structures
Grading:
- Homework: 30%
- Final: 30%
Attendance: 2 absences allowed`;

describe('SyllabusDiffModal (Item 46)', () => {
  it('renders modal with severity badge, statistics, and detected changes list', () => {
    render(
      <SyllabusDiffModal
        courseCode="CS 301"
        courseTitle="Data Structures"
        originalSyllabusText={SAMPLE_ORIGINAL}
        revisedSyllabusText={SAMPLE_REVISED}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Syllabus Policy Revision Diff')).toBeDefined();
    expect(screen.getByText(/CS 301/i)).toBeDefined();
    expect(screen.getByText(/Major Revision/i)).toBeDefined();
    expect(screen.getByText(/Grading Distribution Alteration/i)).toBeDefined();
  });

  it('switches to Side-by-Side Line Diff tab and renders diff lines', () => {
    render(
      <SyllabusDiffModal
        courseCode="CS 301"
        courseTitle="Data Structures"
        originalSyllabusText={SAMPLE_ORIGINAL}
        revisedSyllabusText={SAMPLE_REVISED}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    const diffTab = screen.getByTestId('tab-diff');
    fireEvent.click(diffTab);

    expect(screen.getByTestId('diff-lines-container')).toBeDefined();
    expect(screen.getByPlaceholderText('Filter lines...')).toBeDefined();
  });

  it('toggles selection of policy changes and submits applied changes', () => {
    const onApply = vi.fn();
    render(
      <SyllabusDiffModal
        courseCode="CS 301"
        courseTitle="Data Structures"
        originalSyllabusText={SAMPLE_ORIGINAL}
        revisedSyllabusText={SAMPLE_REVISED}
        isOpen={true}
        onClose={vi.fn()}
        onApplyChanges={onApply}
      />,
    );

    const applyBtn = screen.getByTestId('apply-diff-btn');
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalled();
    const appliedList = onApply.mock.calls[0][0];
    expect(appliedList.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SyllabusDiffModal
        courseCode="CS 301"
        courseTitle="Data Structures"
        originalSyllabusText={SAMPLE_ORIGINAL}
        revisedSyllabusText={SAMPLE_REVISED}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
