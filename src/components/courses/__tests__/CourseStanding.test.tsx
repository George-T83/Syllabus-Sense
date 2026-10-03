import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CourseStandingStrip } from '../CourseStanding';
import type { SyllabusUpload } from '@/types/syllabus';
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

  describe('estimate note', () => {
    const graded = [
      item({ id: 'hw', gradeWeight: 10, earnedScore: 92 }),
      item({ id: 'final', gradeWeight: 40, completed: false }),
    ];
    const syllabus = {
      id: 's1',
      courseId: 'cs',
      fileName: 'syllabus.pdf',
      storagePath: 'users/u/syllabi/cs/s1-syllabus.pdf',
      downloadURL: '',
      sizeBytes: 1,
      uploadedAt: '2026-09-01T00:00:00.000Z',
    } as SyllabusUpload;

    it('calls the grade an estimate and names the official source', () => {
      render(<CourseStandingStrip onOpenCalculator={vi.fn()} items={graded} />);
      expect(screen.getByText(/An estimate from the scores and weights you entered/)).toBeTruthy();
      expect(screen.getByText(/gradebook is the official grade/)).toBeTruthy();
    });

    it('says the weights were read by AI, and can be checked, when they came from the syllabus', () => {
      render(
        <CourseStandingStrip
          onOpenCalculator={vi.fn()}
          syllabus={syllabus}
          items={[
            item({ id: 'hw', gradeWeight: 10, earnedScore: 92, source: 'ai' }),
            item({ id: 'final', gradeWeight: 40, completed: false, source: 'ai' }),
          ]}
        />,
      );
      expect(
        screen.getByText(/weights were read from your syllabus by AI and can be wrong/),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check the syllabus' })).toBeTruthy();
    });

    it('has no syllabus link when the course has no syllabus on file', () => {
      render(
        <CourseStandingStrip
          onOpenCalculator={vi.fn()}
          items={[item({ id: 'hw', gradeWeight: 10, earnedScore: 92, source: 'ai' })]}
        />,
      );
      expect(screen.getByText(/read from your syllabus by AI/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Check the syllabus' })).toBeNull();
    });

    it('does not claim AI read hand-entered weights', () => {
      render(
        <CourseStandingStrip
          onOpenCalculator={vi.fn()}
          items={[item({ id: 'hw', gradeWeight: 10, earnedScore: 92, source: 'manual' })]}
        />,
      );
      expect(screen.queryByText(/by AI/)).toBeNull();
    });
  });
});
