import { describe, it, expect } from 'vitest';
import { detectExamCollisions } from '@/lib/planner/examCollisionDetector';
import type { ScheduleItem } from '@/types/schedule';

const base: Omit<ScheduleItem, 'id' | 'title' | 'type' | 'dueDate'> = {
  courseId: 'c1',
  completed: false,
  priority: 'medium',
  gradeWeight: 20,
  estimatedHours: 2,
};

function makeItem(
  id: string,
  type: ScheduleItem['type'],
  dueDate: string,
  completed = false,
): ScheduleItem {
  return { ...base, id, title: id, type, dueDate, completed } as ScheduleItem;
}

describe('detectExamCollisions', () => {
  it('returns empty array when fewer than 2 graded items', () => {
    expect(detectExamCollisions([makeItem('a', 'exam', '2026-11-10')])).toEqual([]);
  });

  it('detects critical alert for 2 exams within 48 hours', () => {
    const items = [
      makeItem('exam1', 'exam', '2026-11-10'),
      makeItem('exam2', 'quiz', '2026-11-11'),
    ];
    const alerts = detectExamCollisions(items);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].items).toHaveLength(2);
  });

  it('detects warning alert for 3+ graded items (no 2 exams) within 48 hours', () => {
    const items = [
      makeItem('a', 'assignment', '2026-11-10'),
      makeItem('b', 'project', '2026-11-11'),
      makeItem('c', 'lab', '2026-11-11'),
    ];
    const alerts = detectExamCollisions(items);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].items).toHaveLength(3);
  });

  it('does not alert when only 2 assignments (not exams) within 48 hours', () => {
    const items = [
      makeItem('a', 'assignment', '2026-11-10'),
      makeItem('b', 'assignment', '2026-11-11'),
    ];
    expect(detectExamCollisions(items)).toHaveLength(0);
  });

  it('ignores completed items', () => {
    const items = [
      makeItem('exam1', 'exam', '2026-11-10', true),
      makeItem('exam2', 'quiz', '2026-11-11'),
    ];
    expect(detectExamCollisions(items)).toHaveLength(0);
  });

  it('anchors alert to earliest date in the cluster', () => {
    const items = [
      makeItem('exam1', 'exam', '2026-11-12'),
      makeItem('exam2', 'quiz', '2026-11-10'),
    ];
    const alerts = detectExamCollisions(items);
    expect(alerts[0].date).toBe('2026-11-10');
  });

  it('does not alert for items more than 48 hours apart', () => {
    const items = [
      makeItem('exam1', 'exam', '2026-11-10'),
      makeItem('exam2', 'quiz', '2026-11-13'),
    ];
    expect(detectExamCollisions(items)).toHaveLength(0);
  });
});
