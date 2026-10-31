import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AppStateProvider, useAppState } from '@/context/AppStateContext';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { Source } from '@/types/source';
import type { Flashcard } from '@/types/flashcard';
import type { Quiz, QuizAttempt } from '@/types/quiz';

const live: Course = { id: 'live', code: 'CS 101', title: 'Intro' };
const old: Course = {
  id: 'old',
  code: 'MA 101',
  title: 'Calc',
  archivedAt: '2026-10-01T12:00:00.000Z',
};

const item = (id: string, courseId: string) => ({ id, courseId, title: id }) as ScheduleItem;
const base = {
  courses: [live, old],
  scheduleItems: [item('t-live', 'live'), item('t-old', 'old')],
  contacts: [
    { id: 'c-live', courseId: 'live' },
    { id: 'c-old', courseId: 'old' },
  ] as Contact[],
  sources: [
    { id: 's-live', courseId: 'live' },
    { id: 's-old', courseId: 'old' },
  ] as Source[],
  flashcards: [
    { id: 'f-live', courseId: 'live' },
    { id: 'f-old', courseId: 'old' },
  ] as Flashcard[],
  quizzes: [
    { id: 'q-live', courseId: 'live' },
    { id: 'q-old', courseId: 'old' },
  ] as Quiz[],
  quizAttempts: [
    { id: 'a-live', courseId: 'live' },
    { id: 'a-old', courseId: 'old' },
  ] as QuizAttempt[],
};

let ctx: ReturnType<typeof useAppState>;
function Probe() {
  ctx = useAppState();
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).join(',');
  const { state, archived } = ctx;
  return (
    <div>
      <span data-testid="active">
        {[
          state.courses,
          state.scheduleItems,
          state.contacts,
          state.sources,
          state.flashcards,
          state.quizzes,
          state.quizAttempts,
        ]
          .map(ids)
          .join(' | ')}
      </span>
      <span data-testid="archived">
        {[
          archived.courses,
          archived.scheduleItems,
          archived.contacts,
          archived.sources,
          archived.flashcards,
          archived.quizzes,
          archived.quizAttempts,
        ]
          .map(ids)
          .join(' | ')}
      </span>
      <span data-testid="selected">{state.selectedCourseId ?? 'none'}</span>
    </div>
  );
}
const mount = (extra = {}) =>
  render(
    <AppStateProvider initialState={{ ...base, ...extra }}>
      <Probe />
    </AppStateProvider>,
  );

describe('AppStateProvider with an archived course', () => {
  it('leaves the archived course and everything that belongs to it out of the state every screen reads', () => {
    mount();
    expect(screen.getByTestId('active').textContent).toBe(
      'live | t-live | c-live | s-live | f-live | q-live | a-live',
    );
  });

  it('keeps them, whole, in the archived part', () => {
    mount();
    expect(screen.getByTestId('archived').textContent).toBe(
      'old | t-old | c-old | s-old | f-old | q-old | a-old',
    );
  });

  it('does not keep an archived course selected', () => {
    mount({ selectedCourseId: 'old' });
    expect(screen.getByTestId('selected').textContent).toBe('none');
  });

  it('returns the very same arrays when nothing is archived, so there is no extra rendering', () => {
    const courses = [live];
    const scheduleItems = [item('t-live', 'live')];
    render(
      <AppStateProvider initialState={{ courses, scheduleItems }}>
        <Probe />
      </AppStateProvider>,
    );
    expect(ctx.state.courses).toBe(courses);
    expect(ctx.state.scheduleItems).toBe(scheduleItems);
    expect(ctx.archived.courses).toEqual([]);
  });

  it('moves a course out when it is archived and back, with its records, when it is restored', () => {
    mount({ courses: [live, { ...old, archivedAt: undefined }] });
    expect(screen.getByTestId('active').textContent).toContain('old');

    act(() => ctx.dispatch({ type: 'UPDATE_COURSE', payload: { ...old } }));
    expect(screen.getByTestId('active').textContent).toBe(
      'live | t-live | c-live | s-live | f-live | q-live | a-live',
    );
    expect(screen.getByTestId('archived').textContent).toContain('t-old');

    act(() => ctx.dispatch({ type: 'UPDATE_COURSE', payload: { ...old, archivedAt: undefined } }));
    expect(screen.getByTestId('active').textContent).toContain('old | t-live,t-old');
    expect(screen.getByTestId('archived').textContent).toBe(' |  |  |  |  |  | ');
  });

  it('removes an archived course and its records for good when it is deleted', () => {
    mount();
    act(() => ctx.dispatch({ type: 'REMOVE_COURSE', payload: 'old' }));
    expect(screen.getByTestId('archived').textContent).toBe(' |  |  |  |  |  | ');
    expect(screen.getByTestId('active').textContent).toContain('t-live');
  });

  it('keeps arrays stable across an unrelated change, so memoized screens do not recompute', () => {
    mount();
    const before = ctx.state.scheduleItems;
    act(() => ctx.dispatch({ type: 'SELECT_TERM', payload: 'all' }));
    expect(ctx.state.scheduleItems).toBe(before);
  });
});
