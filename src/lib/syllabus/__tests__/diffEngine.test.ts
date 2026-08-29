import { describe, it, expect } from 'vitest';
import {
  computeLineDiff,
  analyzeSyllabusRevision,
} from '../diffEngine';

const ORIGINAL_SYLLABUS = `CS 301 - Data Structures
Instructor: Dr. Alan Turing (Room 101)
Office Hours: Tuesdays 2:00 PM - 4:00 PM

Grading Breakdown:
- Homework: 20%
- Midterm Exam: 30%
- Final Exam: 30%
- Quizzes: 20%

Late Policy:
Submissions allowed up to 2 days late with 10% deduction per day.

Attendance:
3 unexcused absences allowed before grade penalty.
Exam 1 Date: Oct 15
Final Exam: Dec 10`;

const REVISED_SYLLABUS = `CS 301 - Data Structures
Instructor: Dr. Alan Turing (Room 204)
Office Hours: Tuesdays & Thursdays 3:00 PM - 5:00 PM

Grading Breakdown:
- Homework: 25%
- Midterm Exam: 25%
- Final Exam: 30%
- Quizzes: 20%

Late Policy:
Submissions allowed up to 3 days late with 5% deduction per day.

Attendance:
2 unexcused absences allowed before grade penalty.
Exam 1 Date: Oct 22
Final Exam: Dec 12`;

describe('Syllabus Diff Engine (Item 46)', () => {
  it('computes line-by-line diffs with additions and removals', () => {
    const diff = computeLineDiff(
      'Line 1\nLine 2\nLine 3',
      'Line 1\nLine 2 modified\nLine 3'
    );

    expect(diff.some((l) => l.type === 'unchanged' && l.content === 'Line 1')).toBe(true);
    expect(diff.some((l) => l.type === 'removed' && l.content === 'Line 2')).toBe(true);
    expect(diff.some((l) => l.type === 'added' && l.content === 'Line 2 modified')).toBe(true);
  });

  it('detects policy changes in grading weights, late work, and exam dates', () => {
    const report = analyzeSyllabusRevision(ORIGINAL_SYLLABUS, REVISED_SYLLABUS);

    expect(report.totalAdditions).toBeGreaterThan(0);
    expect(report.totalDeletions).toBeGreaterThan(0);
    expect(report.overallSeverity).toBe('major');

    // Section alterations detected
    expect(report.sectionsModified).toContain('Grading Scheme & Weights');
    expect(report.sectionsModified).toContain('Late Submission Policy');
    expect(report.sectionsModified).toContain('Attendance & Absence Policy');
    expect(report.sectionsModified).toContain('Exam Schedule & Deadlines');
    expect(report.sectionsModified).toContain('Office Hours & Contact Info');

    // Check grading change entry
    const gradingChange = report.changes.find((c) => c.category === 'grading');
    expect(gradingChange?.severity).toBe('major');
    expect(gradingChange?.title).toContain('Grading');
  });

  it('identifies identical syllabi with zero modifications', () => {
    const report = analyzeSyllabusRevision(ORIGINAL_SYLLABUS, ORIGINAL_SYLLABUS);

    expect(report.totalAdditions).toBe(0);
    expect(report.totalDeletions).toBe(0);
    expect(report.changes.length).toBe(0);
    expect(report.overallSeverity).toBe('minor');
  });
});
