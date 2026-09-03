import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import {
  AppStateProvider,
  useAppState,
  appStateReducer,
  initialAppState,
  getSelectedCourse,
  getScheduleItemsByCourse,
  AppState,
} from '@/context/AppStateContext';
import { Course, ScheduleItem } from '@/types/schedule';
import { DEFAULT_PREFERENCES } from '@/lib/firestore/preferences';

// Helper component that consumes useAppState
function TestConsumer() {
  const { state, dispatch } = useAppState();
  return (
    <div>
      <span data-testid="selected-course-id">{state.selectedCourseId || 'none'}</span>
      <span data-testid="courses-count">{state.courses.length}</span>
      <div data-testid="courses-list">
        {state.courses.map((c) => (
          <span key={c.id} data-testid={`course-${c.id}`}>
            {c.code}
          </span>
        ))}
      </div>
      <div data-testid="items-list">
        {state.scheduleItems.map((item) => (
          <div key={item.id}>
            <span data-testid={`item-${item.id}-title`}>{item.title}</span>
            <span data-testid={`item-${item.id}-status`}>
              {item.completed ? 'done' : 'pending'}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          dispatch({
            type: 'ADD_COURSE',
            payload: { id: 'c3', code: 'TEST 101', title: 'Test Course' },
          })
        }
        data-testid="add-course-btn"
      >
        Add Course
      </button>
      <button
        onClick={() => dispatch({ type: 'SELECT_COURSE', payload: 'c3' })}
        data-testid="select-course-btn"
      >
        Select Course
      </button>
    </div>
  );
}

// Helper component that triggers hook outside provider to test error throwing
function FaultyConsumer() {
  useAppState();
  return null;
}

describe('AppStateContext Reducer & Selectors', () => {
  const mockCourse: Course = { id: 'c1', code: 'CS 101', title: 'Intro' };
  const mockItem: ScheduleItem = {
    id: 'i1',
    courseId: 'c1',
    title: 'Homework 1',
    type: 'assignment',
    dueDate: '2026-09-01T23:59:59.000Z',
    completed: false,
  };

  it('handles ADD_COURSE and REMOVE_COURSE', () => {
    let state = appStateReducer(initialAppState, { type: 'ADD_COURSE', payload: mockCourse });
    expect(state.courses).toHaveLength(1);
    expect(state.courses[0]).toEqual(mockCourse);

    state = appStateReducer(state, { type: 'SELECT_COURSE', payload: 'c1' });
    expect(state.selectedCourseId).toBe('c1');

    state = appStateReducer(state, { type: 'REMOVE_COURSE', payload: 'c1' });
    expect(state.courses).toHaveLength(0);
    // Removing selected course should clear selectedCourseId
    expect(state.selectedCourseId).toBeNull();
  });

  it('handles UPDATE_COURSE', () => {
    let state = appStateReducer(initialAppState, { type: 'ADD_COURSE', payload: mockCourse });
    const updated: Course = { ...mockCourse, title: 'Intro to Computer Science' };

    state = appStateReducer(state, { type: 'UPDATE_COURSE', payload: updated });
    expect(state.courses).toHaveLength(1);
    expect(state.courses[0].title).toBe('Intro to Computer Science');
  });

  it('REMOVE_COURSE also removes that course schedule items, leaving other courses untouched', () => {
    const otherItem: ScheduleItem = {
      id: 'i2',
      courseId: 'c2',
      title: 'Reading for another course',
      type: 'reading',
      dueDate: '2026-09-05T23:59:59.000Z',
      completed: false,
    };

    let state = appStateReducer(initialAppState, { type: 'ADD_COURSE', payload: mockCourse });
    state = appStateReducer(state, { type: 'ADD_SCHEDULE_ITEM', payload: mockItem });
    state = appStateReducer(state, { type: 'ADD_SCHEDULE_ITEM', payload: otherItem });
    expect(state.scheduleItems).toHaveLength(2);

    state = appStateReducer(state, { type: 'REMOVE_COURSE', payload: 'c1' });

    // The deleted course leaves no orphaned work behind...
    expect(state.scheduleItems.some((item) => item.courseId === 'c1')).toBe(false);
    // ...but items belonging to other courses survive.
    expect(state.scheduleItems).toHaveLength(1);
    expect(state.scheduleItems[0].id).toBe('i2');
  });

  it('handles ADD_SCHEDULE_ITEM, UPDATE_SCHEDULE_ITEM, REMOVE_SCHEDULE_ITEM, and TOGGLE_SCHEDULE_ITEM_COMPLETED', () => {
    let state = appStateReducer(initialAppState, { type: 'ADD_SCHEDULE_ITEM', payload: mockItem });
    expect(state.scheduleItems).toHaveLength(1);
    expect(state.scheduleItems[0]).toEqual(mockItem);

    // Toggle completion status
    state = appStateReducer(state, { type: 'TOGGLE_SCHEDULE_ITEM_COMPLETED', payload: 'i1' });
    expect(state.scheduleItems[0].completed).toBe(true);

    state = appStateReducer(state, { type: 'TOGGLE_SCHEDULE_ITEM_COMPLETED', payload: 'i1' });
    expect(state.scheduleItems[0].completed).toBe(false);

    // Update item
    const updatedItem: ScheduleItem = {
      ...mockItem,
      title: 'Homework 1 Revised',
      estimatedHours: 3,
    };
    state = appStateReducer(state, { type: 'UPDATE_SCHEDULE_ITEM', payload: updatedItem });
    expect(state.scheduleItems[0].title).toBe('Homework 1 Revised');
    expect(state.scheduleItems[0].estimatedHours).toBe(3);

    // Remove item
    state = appStateReducer(state, { type: 'REMOVE_SCHEDULE_ITEM', payload: 'i1' });
    expect(state.scheduleItems).toHaveLength(0);
  });

  it('handles SELECT_TERM', () => {
    let state = appStateReducer(initialAppState, { type: 'SELECT_TERM', payload: 'Fall 2026' });
    expect(state.selectedTerm).toBe('Fall 2026');

    state = appStateReducer(state, { type: 'SELECT_TERM', payload: 'all' });
    expect(state.selectedTerm).toBe('all');
  });

  it('defaults preferences and applies SET_PREFERENCES', () => {
    expect(initialAppState.preferences).toEqual(DEFAULT_PREFERENCES);

    const next = { ...DEFAULT_PREFERENCES, taskRowVariant: 'touch' as const };
    const state = appStateReducer(initialAppState, { type: 'SET_PREFERENCES', payload: next });
    expect(state.preferences.taskRowVariant).toBe('touch');
    // Untouched fields carry through the whole-object replace.
    expect(state.preferences.dailyDigest).toBe(DEFAULT_PREFERENCES.dailyDigest);
  });

  it('handles SET_COURSES and SET_SCHEDULE_ITEMS', () => {
    let state = appStateReducer(initialAppState, { type: 'SET_COURSES', payload: [mockCourse] });
    expect(state.courses).toHaveLength(1);
    expect(state.initialized).toBe(true);

    state = appStateReducer(state, { type: 'SET_SCHEDULE_ITEMS', payload: [mockItem] });
    expect(state.scheduleItems).toHaveLength(1);
  });

  it('selectors work correctly', () => {
    const customState: AppState = {
      courses: [mockCourse],
      scheduleItems: [mockItem],
      contacts: [],
      sources: [],
      flashcards: [],
      selectedCourseId: 'c1',
      selectedTerm: null,
      preferences: DEFAULT_PREFERENCES,
      initialized: true,
    };

    expect(getSelectedCourse(customState)).toEqual(mockCourse);

    const filteredItems = getScheduleItemsByCourse(customState, 'c1');
    expect(filteredItems).toHaveLength(1);
    expect(filteredItems[0]).toEqual(mockItem);

    const nonExistentFilter = getScheduleItemsByCourse(customState, 'c2');
    expect(nonExistentFilter).toHaveLength(0);

    const nullFilter = getScheduleItemsByCourse(customState, null);
    expect(nullFilter).toHaveLength(0);
  });
});

describe('AppStateProvider Context', () => {
  it('throws an error when useAppState is used outside AppStateProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<FaultyConsumer />)).toThrow(
      'useAppState must be used within an AppStateProvider',
    );

    consoleSpy.mockRestore();
  });

  it('propagates state updates to consumer components', () => {
    const mockCourse: Course = { id: 'c1', code: 'CS 101', title: 'Intro' };
    const mockItem: ScheduleItem = {
      id: 'i1',
      courseId: 'c1',
      title: 'Homework 1',
      type: 'assignment',
      dueDate: '2026-09-01T23:59:59.000Z',
      completed: false,
    };

    render(
      <AppStateProvider initialState={{ courses: [mockCourse], scheduleItems: [mockItem] }}>
        <TestConsumer />
      </AppStateProvider>,
    );

    expect(screen.getByTestId('courses-count').textContent).toBe('1');
    expect(screen.getByTestId('course-c1').textContent).toBe('CS 101');
    expect(screen.getByTestId('item-i1-title').textContent).toBe('Homework 1');
    expect(screen.getByTestId('item-i1-status').textContent).toBe('pending');
    expect(screen.getByTestId('selected-course-id').textContent).toBe('none');

    // Click button to add course
    act(() => {
      screen.getByTestId('add-course-btn').click();
    });
    expect(screen.getByTestId('courses-count').textContent).toBe('2');
    expect(screen.getByTestId('course-c3').textContent).toBe('TEST 101');

    // Click button to select course
    act(() => {
      screen.getByTestId('select-course-btn').click();
    });
    expect(screen.getByTestId('selected-course-id').textContent).toBe('c3');
  });
});
