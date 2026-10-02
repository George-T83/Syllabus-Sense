import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GpaGoalRadial } from '../GpaGoalRadial';
import type { GpaGoalCourse } from '@/lib/gpa/termCourses';

const COURSES: GpaGoalCourse[] = [
  {
    courseId: 'c1',
    courseCode: 'CSCI 213',
    title: 'Computer Science I',
    credits: 4,
    grade: 'A',
    standingNote: 'Currently 96% (A)',
  },
  {
    courseId: 'c2',
    courseCode: 'MATH 301',
    title: 'Linear Algebra',
    credits: 3,
    grade: 'C+',
    standingNote: 'Currently 78% (C+)',
  },
  { courseId: 'c3', courseCode: 'HIST 150', title: 'World History', credits: 1, grade: null },
];

describe('GpaGoalRadial', () => {
  it('renders two labelled rings and a status badge from real courses', () => {
    render(<GpaGoalRadial courses={COURSES} />);

    expect(screen.getByText('Semester GPA Goal & Quality Points Tracker')).toBeDefined();
    expect(screen.getByTestId('gpa-status-badge')).toBeDefined();
    const rings = screen.getAllByRole('progressbar');
    expect(rings).toHaveLength(2);
    expect(rings[0].getAttribute('aria-label')).toMatch(/Current term GPA/i);
    expect(rings[1].getAttribute('aria-label')).toMatch(/Projected cumulative GPA/i);
  });

  it('computes the term GPA from the real grades and credits, leaving ungraded courses out', () => {
    render(<GpaGoalRadial courses={COURSES} />);

    // (4 cr x 4.0 + 3 cr x 2.3) / 7 cr = 3.27. The ungraded 1-credit course is not counted.
    expect(screen.getAllByText('3.27').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/7 Credits/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Currently 96% (A)')).toBeDefined();
    expect(screen.getAllByText('No grades entered yet')).toHaveLength(1);
  });

  it('starts with the prior-history inputs empty instead of an invented GPA', () => {
    render(<GpaGoalRadial courses={COURSES} />);

    expect((screen.getByLabelText(/Prior cumulative GPA/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Prior earned credits/i) as HTMLInputElement).value).toBe('');
    // With no prior history the cumulative figure is just the term's own GPA.
    expect(screen.getByText(/Projected Cumul \(3\.27\)/)).toBeDefined();
  });

  it('only folds in prior history once both prior fields are filled in', () => {
    render(<GpaGoalRadial courses={COURSES} />);
    const gpa = screen.getByLabelText(/Prior cumulative GPA/i);
    const credits = screen.getByLabelText(/Prior earned credits/i);

    fireEvent.change(gpa, { target: { value: '3.0' } });
    expect(screen.getByText(/Projected Cumul \(3\.27\)/)).toBeDefined();

    fireEvent.change(credits, { target: { value: '45' } });
    // (3.0 x 45 + 22.9 qp) / 52 cr = 3.04
    expect(screen.getByText(/Projected Cumul \(3\.04\)/)).toBeDefined();
  });

  it('shows an honest empty state when there are no courses', () => {
    render(<GpaGoalRadial courses={[]} />);

    expect(screen.getByText('No grades yet')).toBeDefined();
    expect(screen.queryByText(/On Track/i)).toBeNull();
    expect(screen.queryByText(/Ahead of Goal/i)).toBeNull();
    expect(screen.getByText(/No courses to simulate yet/i)).toBeDefined();
    expect(screen.getByText(/Add a course to start tracking your GPA/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Go to Courses/i }).getAttribute('href')).toBe(
      '/courses',
    );
    expect(screen.queryByText('3.42')).toBeNull();
  });

  it('shows dashes, not 0.00, when courses exist but none are graded', () => {
    render(
      <GpaGoalRadial
        courses={[
          { courseId: 'c1', courseCode: 'ENGL 101', title: 'Writing', credits: 3, grade: null },
        ]}
      />,
    );

    expect(screen.getByText('No grades yet')).toBeDefined();
    expect(screen.queryByText('0.00')).toBeNull();
    expect(screen.getByText(/Enter a grade on one of your courses/i)).toBeDefined();
  });

  it('lets a what-if grade fill in an ungraded course and recalculates', () => {
    render(<GpaGoalRadial courses={COURSES} />);

    fireEvent.change(screen.getByLabelText(/HIST 150 grade/i), { target: { value: 'A' } });
    // (16 + 6.9 + 4) / 8 cr = 3.36
    expect(screen.getAllByText('3.36').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/8 Credits/i).length).toBeGreaterThanOrEqual(1);
  });

  it('updates simulated course credit hours and recalculates total term credits', () => {
    render(<GpaGoalRadial courses={COURSES} />);

    fireEvent.change(screen.getByLabelText(/CSCI 213 credits/i), { target: { value: '5' } });
    expect(screen.getAllByText(/8 Credits/i).length).toBeGreaterThanOrEqual(1);
  });

  it('follows the real courses when they change, keeping what-if edits', () => {
    const { rerender } = render(<GpaGoalRadial courses={COURSES} />);
    fireEvent.change(screen.getByLabelText(/MATH 301 grade/i), { target: { value: 'B' } });

    rerender(
      <GpaGoalRadial
        courses={[
          ...COURSES,
          { courseId: 'c4', courseCode: 'ART 101', title: 'Drawing', credits: 3, grade: 'A' },
        ]}
      />,
    );

    expect(screen.getByLabelText(/ART 101 grade/i)).toBeDefined();
    expect((screen.getByLabelText(/MATH 301 grade/i) as HTMLSelectElement).value).toBe('B');
  });

  it('updates target GPA dynamically when input changes', () => {
    render(<GpaGoalRadial courses={COURSES} initialTargetGpa={3.5} />);

    fireEvent.change(screen.getByLabelText(/Target cumulative GPA/i), { target: { value: '3.8' } });
    expect(screen.getByText(/Goal Slider: 3.80/i)).toBeDefined();
  });

  it('colors the cumulative ring semantically by goal status', () => {
    render(
      <GpaGoalRadial
        courses={COURSES}
        initialPriorGpa={3.9}
        initialPriorCredits={90}
        initialTargetGpa={3.0}
      />,
    );

    expect(screen.getByText(/Ahead of Goal/i)).toBeDefined();
    const cumulativeRing = screen.getAllByRole('progressbar')[1];
    const arc = cumulativeRing.querySelectorAll('circle')[1];
    expect(arc.getAttribute('class')).toMatch(/stroke-load-low/);
  });
});
