import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppStateProvider } from '@/context/AppStateContext';
import { useTermMigration } from '../useTermMigration';
import { termIdForLabel } from '../termMigration';
import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';

const mockApply = vi.fn();
vi.mock('@/lib/firestore/terms', () => ({
  applyTermMigration: (...args: unknown[]) => mockApply(...args),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));

function Probe() {
  const labels = useTermMigration();
  return <div data-testid="unknown">{labels.join('|')}</div>;
}

const course = (id: string, term?: string, extra: Partial<Course> = {}): Course =>
  ({ id, code: id, title: id, ...(term ? { term } : {}), ...extra }) as Course;

function renderProbe(state: {
  courses: Course[];
  terms?: Term[];
  initialized?: boolean;
  termsLoaded?: boolean;
}) {
  return render(
    <AppStateProvider initialState={{ terms: [], initialized: true, termsLoaded: true, ...state }}>
      <Probe />
    </AppStateProvider>,
  );
}

beforeEach(() => {
  mockApply.mockReset().mockResolvedValue(undefined);
});

describe('useTermMigration', () => {
  it('creates terms with the standard dates for known labels and links their courses', () => {
    renderProbe({ courses: [course('a', 'Fall 2026'), course('b', 'Fall 2026')] });
    expect(mockApply).toHaveBeenCalledTimes(1);
    const [uid, plan] = mockApply.mock.calls[0];
    expect(uid).toBe('u1');
    expect(plan.newTerms).toEqual([
      {
        id: termIdForLabel('Fall 2026'),
        label: 'Fall 2026',
        startDate: '2026-08-24',
        endDate: '2026-12-18',
      },
    ]);
    expect(plan.courseLinks.map((l: { courseId: string }) => l.courseId)).toEqual(['a', 'b']);
  });

  it('returns labels it cannot date, and writes nothing for them', () => {
    renderProbe({ courses: [course('a', 'Winter 2027'), course('b', 'Block 3')] });
    expect(mockApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('unknown').textContent).toBe('Winter 2027|Block 3');
  });

  it('migrates the known labels and still reports the unknown ones', () => {
    renderProbe({ courses: [course('a', 'Spring 2027'), course('b', 'Winter 2027')] });
    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply.mock.calls[0][1].courseLinks).toHaveLength(1);
    expect(screen.getByTestId('unknown').textContent).toBe('Winter 2027');
  });

  it('waits until courses and terms have both loaded', () => {
    renderProbe({ courses: [course('a', 'Fall 2026')], termsLoaded: false });
    expect(mockApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('unknown').textContent).toBe('');
  });

  it('does nothing when every course is already linked or has no term', () => {
    const fall: Term = {
      id: 't',
      label: 'Fall 2026',
      startDate: '2026-08-24',
      endDate: '2026-12-18',
    };
    renderProbe({
      courses: [course('a', 'Fall 2026', { termId: 't' }), course('b')],
      terms: [fall],
    });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('uses the term the student already has instead of creating a second one', () => {
    const mine: Term = {
      id: 'mine',
      label: 'Fall 2026',
      startDate: '2026-09-01',
      endDate: '2026-12-10',
    };
    renderProbe({ courses: [course('a', 'fall 2026')], terms: [mine] });
    const plan = mockApply.mock.calls[0][1];
    expect(plan.newTerms).toEqual([]);
    expect(plan.courseLinks).toEqual([{ courseId: 'a', termId: 'mine' }]);
  });
});
