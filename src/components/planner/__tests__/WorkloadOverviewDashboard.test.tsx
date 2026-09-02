import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WorkloadOverviewDashboard } from '../WorkloadOverviewDashboard';
import { AppStateProvider } from '@/context/AppStateContext';
import { AuthProvider } from '@/context/AuthContext';
import { toLocalDateStr } from '@/lib/planner/projectChunker';
import * as scheduleItemsLib from '@/lib/firestore/scheduleItems';
import type { ScheduleItem, AssignmentType, Course } from '@/types/schedule';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-auth-domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project-id';
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({ uid: 'test-user-uid', email: 'student@example.edu', displayName: 'Student' });
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

const mockCourses: Course[] = [
  { id: 'c1', code: 'CSCI 310', title: 'Algorithms', color: 'bg-blue-500' },
  { id: 'c2', code: 'MATH 220', title: 'Discrete Math', color: 'bg-green-500' },
];

function createItem(params: {
  id: string;
  title: string;
  dueDate: string;
  estimatedHours?: number;
  completed?: boolean;
  type?: string;
  courseId?: string;
}): ScheduleItem {
  return {
    id: params.id,
    title: params.title,
    dueDate: params.dueDate,
    estimatedHours: params.estimatedHours,
    completed: params.completed ?? false,
    type: (params.type || 'assignment') as AssignmentType,
    courseId: params.courseId || 'c1',
  };
}

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateStr(d);
}

/** The 7-Day Forecast renders one row-button per day, each always showing
 * an "X.Xh" hours figure - unlike the item count ("1 item" vs "N items"),
 * the hour format never changes shape based on the count, so filtering on
 * it reliably selects exactly the 7 forecast rows regardless of how many
 * items happen to fall on any given day. */
function getForecastDayButtons(): HTMLElement[] {
  // No trailing \b: the item count's digit runs directly into this "h"
  // with no separator in the concatenated textContent (e.g. "...0.0h0
  // items..."), which would make a word-boundary assertion after "h" fail.
  return screen.getAllByRole('button').filter((btn) => /\d+\.\d+h/.test(btn.textContent ?? ''));
}

function renderDashboard(
  items: ScheduleItem[] = [],
  props: Partial<React.ComponentProps<typeof WorkloadOverviewDashboard>> = {},
) {
  return render(
    <AuthProvider>
      <AppStateProvider initialState={{ courses: mockCourses, scheduleItems: items }}>
        <WorkloadOverviewDashboard {...props} />
      </AppStateProvider>
    </AuthProvider>,
  );
}

describe('WorkloadOverviewDashboard Component Suite (Tier 1-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TIER 1: Feature Coverage (F4, F5, F6, F7, F8)
  // =========================================================================

  describe('Tier 1: Feature F4 - 7-Day Workload Forecast Grid', () => {
    it('F4-1: renders header with title and 7-day forecast grid', () => {
      renderDashboard();
      expect(screen.getByText(/Daily & Weekly Workload Center/i)).toBeDefined();
      expect(screen.getByText(/Academic Workload & Pace Advisor/i)).toBeDefined();
      expect(screen.getByText(/7-Day Forecast/i)).toBeDefined();
    });

    it('F4-2: renders exactly 7 day buttons in forecast grid', () => {
      renderDashboard();
      const forecastButtons = getForecastDayButtons();
      expect(forecastButtons).toHaveLength(7);
    });

    it('F4-3: displays light pace indicator for days with <= 2.5h workload', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 't1',
          title: 'Light Reading',
          dueDate: todayStr,
          estimatedHours: 1.5,
          completed: false,
          type: 'reading',
        }),
      ];
      renderDashboard(items);
      const lightBadges = screen.getAllByText(/light/i);
      expect(lightBadges.length).toBeGreaterThan(0);
    });

    it('F4-4: displays moderate pace indicator for days with 2.5h - 5.0h workload', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 't1',
          title: 'Moderate Problem Set',
          dueDate: todayStr,
          estimatedHours: 3.5,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText(/moderate Pace/i)).toBeDefined();
    });

    it('F4-5: displays heavy peak indicator for days with > 5.0h workload', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 't1',
          title: 'Algorithms Study',
          dueDate: todayStr,
          estimatedHours: 4,
          completed: false,
          type: 'exam',
        }),
        createItem({
          id: 't2',
          title: 'Math Homework',
          dueDate: todayStr,
          estimatedHours: 3,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.getAllByText(/⚠️ Heavy Peak/i).length).toBeGreaterThan(0);
    });
  });

  describe('Tier 1: Feature F5 - 1-Click Day Inspection', () => {
    it('F5-1: defaults active day inspector to Today', () => {
      renderDashboard();
      expect(screen.getByText(/Today/i)).toBeDefined();
      expect(screen.getByText(/Workload Load/i)).toBeDefined();
    });

    it('F5-2: clicking a day in the 7-day forecast updates active day inspector', () => {
      const tomorrowStr = getRelativeDateStr(1);
      const items: ScheduleItem[] = [
        createItem({
          id: 'tom-1',
          title: 'Tomorrow Chemistry Lab',
          dueDate: tomorrowStr,
          estimatedHours: 3,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);

      const buttons = getForecastDayButtons();
      const tomorrowBtn = buttons[1];
      fireEvent.click(tomorrowBtn);

      expect(screen.getByText('Tomorrow Chemistry Lab')).toBeDefined();
      expect(screen.getByText('3.0 hrs')).toBeDefined();
    });

    it('F5-3: active day displays total scheduled hours and task count', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 't1',
          title: 'Task 1',
          dueDate: todayStr,
          estimatedHours: 1,
          completed: false,
          type: 'reading',
        }),
        createItem({
          id: 't2',
          title: 'Task 2',
          dueDate: todayStr,
          estimatedHours: 1.5,
          completed: false,
          type: 'quiz',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText('2.5 hrs')).toBeDefined();
      expect(screen.getByText(/Bite-Sized Tasks \(2\)/i)).toBeDefined();
    });

    it('F5-4: shows empty message when active day has no tasks', () => {
      renderDashboard();
      expect(screen.getByText(/No tasks scheduled for this day/i)).toBeDefined();
    });

    it('F5-5: clicking back to Today updates active day inspector to Today', () => {
      renderDashboard();
      const buttons = getForecastDayButtons();
      fireEvent.click(buttons[2]); // click day 3
      expect(screen.queryByText(/Today/i)).toBeNull();

      fireEvent.click(buttons[0]); // click day 1 (today)
      expect(screen.getByText(/Today/i)).toBeDefined();
    });
  });

  describe('Tier 1: Feature F6 - Interactive Date Shifter & Quick-Shift', () => {
    it('F6-1: uncompleted tasks display date picker and quick-shift buttons (-1d, Today, +1d)', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'shiftable-1',
          title: 'Shiftable Project Task',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: false,
          type: 'project',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText(/Move to another day:/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /-1d/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Today/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /\+1d/i })).toBeDefined();
      const dateInput = screen.getByDisplayValue(todayStr);
      expect(dateInput).toBeDefined();
    });

    it('F6-2: changing date input calls updateScheduleItem with new dueDate', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const todayStr = getRelativeDateStr(0);
      const targetNewDate = getRelativeDateStr(3);

      const items: ScheduleItem[] = [
        createItem({
          id: 'item-to-shift',
          title: 'Research Draft',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);

      const dateInput = screen.getByDisplayValue(todayStr);
      fireEvent.change(dateInput, { target: { value: targetNewDate } });

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });

      const callUpdatedItem = updateSpy.mock.calls[0][2];
      expect(callUpdatedItem.id).toBe('item-to-shift');
      expect(callUpdatedItem.dueDate).toBe(targetNewDate);
    });

    it('F6-3: clicking +1d quick shift button shifts task forward by 1 day', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const todayStr = getRelativeDateStr(0);
      const tomorrowStr = getRelativeDateStr(1);

      const items: ScheduleItem[] = [
        createItem({
          id: 'quick-shift-item',
          title: 'Quick Shift Task',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: false,
          type: 'project',
        }),
      ];
      renderDashboard(items);

      const plus1Btn = screen.getByRole('button', { name: /\+1d/i });
      fireEvent.click(plus1Btn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].dueDate).toBe(tomorrowStr);
    });

    it('F6-4: completed tasks do not display date shifter controls', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'completed-item',
          title: 'Finished Lab',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: true,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.queryByText(/Move to another day:/i)).toBeNull();
    });

    it('F6-5: supports custom onShiftDate prop handler', async () => {
      const onShiftDateMock = vi.fn();
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'prop-shift-item',
          title: 'Prop Shift Task',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items, { scheduleItems: items, onShiftDate: onShiftDateMock });

      const plus1Btn = screen.getByRole('button', { name: /\+1d/i });
      fireEvent.click(plus1Btn);

      expect(onShiftDateMock).toHaveBeenCalledWith('prop-shift-item', getRelativeDateStr(1));
    });
  });

  describe('Tier 1: Feature F7 - Retroactive Completion Anchoring', () => {
    it('F7-1: completed task displays line-through title and completed checkbox', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'done-task',
          title: 'Completed Synthesis Notes',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: true,
          type: 'reading',
        }),
      ];
      renderDashboard(items);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      expect(screen.getByText('Completed Synthesis Notes').className).toContain('line-through');
    });

    it('F7-2: clicking checkbox on uncompleted task calls updateScheduleItem to complete it', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'pending-task',
          title: 'Pending Synthesis Notes',
          dueDate: todayStr,
          estimatedHours: 2,
          completed: false,
          type: 'reading',
        }),
      ];
      renderDashboard(items);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      const updatedItem = updateSpy.mock.calls[0][2];
      expect(updatedItem.id).toBe('pending-task');
      expect(updatedItem.completed).toBe(true);
    });

    it('F7-3: clicking checkbox on completed task calls updateScheduleItem to uncomplete it', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'uncomplete-task',
          title: 'Done Task',
          dueDate: todayStr,
          estimatedHours: 1,
          completed: true,
          type: 'quiz',
        }),
      ];
      renderDashboard(items);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].completed).toBe(false);
    });

    it('F7-4: past completed tasks do not trigger rollover warning alert', () => {
      const pastStr = getRelativeDateStr(-2);
      const items: ScheduleItem[] = [
        createItem({
          id: 'past-done',
          title: 'Past Done Homework',
          dueDate: pastStr,
          estimatedHours: 2,
          completed: true,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.queryByText(/Rollover Task/i)).toBeNull();
    });

    it('F7-5: completed task maintains estimated duration badge in task list', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'done-badge-task',
          title: 'Done Lab',
          dueDate: todayStr,
          estimatedHours: 2.5,
          completed: true,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText('150m')).toBeDefined();
    });
  });

  describe('Tier 1: Feature F8 - Dynamic Rollover Recalculation', () => {
    it('F8-1: uncompleted past task displays rollover alert badge in header', () => {
      const yesterdayStr = getRelativeDateStr(-1);
      const items: ScheduleItem[] = [
        createItem({
          id: 'missed-1',
          title: 'Missed Chapter Reading',
          dueDate: yesterdayStr,
          estimatedHours: 2,
          completed: false,
          type: 'reading',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText(/⚠️ 1 Rollover Task/i)).toBeDefined();
    });

    it('F8-2: multiple uncompleted past tasks display correct pluralized rollover count', () => {
      const past1 = getRelativeDateStr(-1);
      const past2 = getRelativeDateStr(-2);
      const items: ScheduleItem[] = [
        createItem({
          id: 'm1',
          title: 'Missed 1',
          dueDate: past1,
          estimatedHours: 1,
          completed: false,
          type: 'quiz',
        }),
        createItem({
          id: 'm2',
          title: 'Missed 2',
          dueDate: past2,
          estimatedHours: 2,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText(/⚠️ 2 Rollover Tasks/i)).toBeDefined();
    });

    it('F8-3: rollover task appears in Today task list with "(Rollover)" appended', () => {
      const yesterdayStr = getRelativeDateStr(-1);
      const items: ScheduleItem[] = [
        createItem({
          id: 'missed-lab',
          title: 'Physics Lab 1',
          dueDate: yesterdayStr,
          estimatedHours: 3,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText('Physics Lab 1 (Rollover)')).toBeDefined();
    });

    it('F8-4: rollover tasks display date shifter to allow rescheduling to future day', () => {
      const yesterdayStr = getRelativeDateStr(-1);
      const items: ScheduleItem[] = [
        createItem({
          id: 'rollover-shift',
          title: 'Missed Vocab Quiz',
          dueDate: yesterdayStr,
          estimatedHours: 1,
          completed: false,
          type: 'quiz',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText(/Move to another day:/i)).toBeDefined();
    });

    it('F8-5: uncompleted past tasks add to Today total hours calculation', () => {
      const yesterdayStr = getRelativeDateStr(-1);
      const items: ScheduleItem[] = [
        createItem({
          id: 'missed-big',
          title: 'Missed Exam Review',
          dueDate: yesterdayStr,
          estimatedHours: 4,
          completed: false,
          type: 'exam',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText('4.0 hrs')).toBeDefined();
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases
  // =========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: renders clean empty state when scheduleItems is empty', () => {
      renderDashboard([]);
      expect(screen.getByText('0.0 hrs')).toBeDefined();
      expect(screen.getByText(/No tasks scheduled for this day/i)).toBeDefined();
      expect(screen.queryByText(/Rollover Task/i)).toBeNull();
    });

    it('B2: opens ProjectChunkerModal when clicking "Divide Project/Exam into Bite Chunks"', () => {
      renderDashboard([]);
      const chunkBtn = screen.getByRole('button', {
        name: /Divide Project\/Exam into Bite Chunks/i,
      });
      fireEvent.click(chunkBtn);
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/Study & Project Bite-Sized Chunker/i)).toBeDefined();
    });

    it('B3: handles item with missing estimatedHours applying fallback', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = [
        createItem({
          id: 'no-hrs-item',
          title: 'Exam Without Hours',
          dueDate: todayStr,
          completed: false,
          type: 'exam',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText('2.0 hrs')).toBeDefined(); // 120m fallback for exam
      expect(screen.getByText('120m')).toBeDefined();
    });

    it('B4: handles high task load on single day without UI clipping', () => {
      const todayStr = getRelativeDateStr(0);
      const items: ScheduleItem[] = Array.from({ length: 15 }, (_, i) =>
        createItem({
          id: `dense-${i}`,
          title: `Dense Task ${i + 1}`,
          dueDate: todayStr,
          estimatedHours: 0.5,
          completed: false,
          type: 'assignment',
        }),
      );
      renderDashboard(items);
      expect(screen.getByText('7.5 hrs')).toBeDefined();
      expect(screen.getByText(/Bite-Sized Tasks \(15\)/i)).toBeDefined();
    });

    it('B5: handles item without dueDate gracefully without breaking forecast', () => {
      const items: ScheduleItem[] = [
        createItem({
          id: 'floating-task',
          title: 'Unscheduled Floating Task',
          dueDate: '',
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);
      expect(screen.getByText('0.0 hrs')).toBeDefined();
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Interactions
  // =========================================================================

  describe('Tier 3: Pairwise & Cross-Feature Interactions', () => {
    it('P1: Inspect Day 3 -> Shift Task to Day 5 -> Verified through updateScheduleItem', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const day3Str = getRelativeDateStr(3);
      const day5Str = getRelativeDateStr(5);

      const items: ScheduleItem[] = [
        createItem({
          id: 'd3-task',
          title: 'Day 3 Capstone Part',
          dueDate: day3Str,
          estimatedHours: 3,
          completed: false,
          type: 'project',
        }),
      ];
      renderDashboard(items);

      // Inspect Day 3
      const buttons = getForecastDayButtons();
      fireEvent.click(buttons[3]);

      // Shift to Day 5
      const dateInput = screen.getByDisplayValue(day3Str);
      fireEvent.change(dateInput, { target: { value: day5Str } });

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].dueDate).toBe(day5Str);
    });

    it('P2: Rollover task toggled completed via checkbox', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const yesterdayStr = getRelativeDateStr(-1);
      const items: ScheduleItem[] = [
        createItem({
          id: 'rollover-toggle',
          title: 'Missed Coding HW',
          dueDate: yesterdayStr,
          estimatedHours: 2,
          completed: false,
          type: 'assignment',
        }),
      ];
      renderDashboard(items);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].completed).toBe(true);
    });

    it('P3: Open Chunker Modal -> Close Chunker Modal -> Dashboard remains interactive', () => {
      renderDashboard([]);
      const chunkBtn = screen.getByRole('button', {
        name: /Divide Project\/Exam into Bite Chunks/i,
      });
      fireEvent.click(chunkBtn);
      expect(screen.getByRole('dialog')).toBeDefined();

      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText(/Daily & Weekly Workload Center/i)).toBeDefined();
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios (>= 5 Scenarios)
  // =========================================================================

  describe('Tier 4: Real-World Scenarios', () => {
    it('Scenario 1: Midterm Sprint High Course Load Workload Dashboard Inspection', () => {
      const todayStr = getRelativeDateStr(0);
      const day2Str = getRelativeDateStr(2);
      const day4Str = getRelativeDateStr(4);

      const items: ScheduleItem[] = [
        createItem({
          id: 'cs-exam-chunk',
          title: 'CS 310 Mock Exam',
          dueDate: todayStr,
          estimatedHours: 3,
          completed: false,
          type: 'exam',
        }),
        createItem({
          id: 'math-exam-chunk',
          title: 'Discrete Math Formula Drill',
          dueDate: day2Str,
          estimatedHours: 2.5,
          completed: false,
          type: 'exam',
        }),
        createItem({
          id: 'cs-project-chunk',
          title: 'Algorithms Project Code',
          dueDate: day4Str,
          estimatedHours: 4,
          completed: false,
          type: 'project',
        }),
      ];

      renderDashboard(items);

      // Verify Today load
      expect(screen.getByText('3.0 hrs')).toBeDefined();
      expect(screen.getByText('CS 310 Mock Exam')).toBeDefined();

      // Inspect Day 2 (Discrete Math)
      const buttons = getForecastDayButtons();
      fireEvent.click(buttons[2]);
      expect(screen.getByText('Discrete Math Formula Drill')).toBeDefined();
      expect(screen.getByText('2.5 hrs')).toBeDefined();

      // Inspect Day 4 (Algorithms Project)
      fireEvent.click(buttons[4]);
      expect(screen.getByText('Algorithms Project Code')).toBeDefined();
      expect(screen.getByText('4.0 hrs')).toBeDefined();
    });

    it('Scenario 2: Post-Illness Rollover Task Recovery and Date Shifting', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const dayMinus2 = getRelativeDateStr(-2);
      const dayMinus1 = getRelativeDateStr(-1);
      const dayPlus2 = getRelativeDateStr(2);

      const items: ScheduleItem[] = [
        createItem({
          id: 'sick-1',
          title: 'Missed Lecture Notes Review',
          dueDate: dayMinus2,
          estimatedHours: 2,
          completed: false,
          type: 'reading',
        }),
        createItem({
          id: 'sick-2',
          title: 'Missed Practice Problems',
          dueDate: dayMinus1,
          estimatedHours: 3,
          completed: false,
          type: 'assignment',
        }),
      ];

      renderDashboard(items);
      expect(screen.getByText(/⚠️ 2 Rollover Tasks/i)).toBeDefined();
      expect(screen.getByText('5.0 hrs')).toBeDefined();

      // Reschedule task 1 to 2 days ahead
      const dateInputs = screen.getAllByDisplayValue(getRelativeDateStr(0));
      fireEvent.change(dateInputs[0], { target: { value: dayPlus2 } });

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].dueDate).toBe(dayPlus2);
    });

    it('Scenario 3: Senior Capstone Milestone Tracking Across 7-Day Window', () => {
      const items: ScheduleItem[] = [
        createItem({
          id: 'cap-1',
          title: 'Capstone: Research & Architecture',
          dueDate: getRelativeDateStr(0),
          estimatedHours: 3,
          completed: true,
          type: 'project',
        }),
        createItem({
          id: 'cap-2',
          title: 'Capstone: Core Feature Implementation',
          dueDate: getRelativeDateStr(2),
          estimatedHours: 5,
          completed: false,
          type: 'project',
        }),
        createItem({
          id: 'cap-3',
          title: 'Capstone: Testing & Bug Fixes',
          dueDate: getRelativeDateStr(5),
          estimatedHours: 4,
          completed: false,
          type: 'project',
        }),
      ];

      renderDashboard(items);

      // Today shows completed research phase
      expect(screen.getByText('Capstone: Research & Architecture')).toBeDefined();
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      // Inspect Day 2 (Core Feature - 5 hours)
      const buttons = getForecastDayButtons();
      fireEvent.click(buttons[2]);
      expect(screen.getByText('Capstone: Core Feature Implementation')).toBeDefined();
      expect(screen.getByText('5.0 hrs')).toBeDefined();
    });

    it('Scenario 4: Rebalancing Heavy Peak Day to Avoid Burnout', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const todayStr = getRelativeDateStr(0);
      const tomorrowStr = getRelativeDateStr(1);

      const items: ScheduleItem[] = [
        createItem({
          id: 'heavy-1',
          title: 'Exam Cram 1',
          dueDate: todayStr,
          estimatedHours: 3.5,
          completed: false,
          type: 'exam',
        }),
        createItem({
          id: 'heavy-2',
          title: 'Exam Cram 2',
          dueDate: todayStr,
          estimatedHours: 3.0,
          completed: false,
          type: 'exam',
        }),
      ];

      renderDashboard(items);
      expect(screen.getByText('6.5 hrs')).toBeDefined();
      expect(screen.getAllByText(/⚠️ Heavy Peak/i).length).toBeGreaterThan(0);

      // Shift Exam Cram 2 to tomorrow
      const dateInputs = screen.getAllByDisplayValue(todayStr);
      fireEvent.change(dateInputs[1], { target: { value: tomorrowStr } });

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].id).toBe('heavy-2');
      expect(updateSpy.mock.calls[0][2].dueDate).toBe(tomorrowStr);
    });

    it('Scenario 5: Complete Interactive Inspection and Task Completion Run', async () => {
      const updateSpy = vi
        .spyOn(scheduleItemsLib, 'updateScheduleItem')
        .mockResolvedValue(undefined);
      const todayStr = getRelativeDateStr(0);

      const items: ScheduleItem[] = [
        createItem({
          id: 'run-1',
          title: 'Task A',
          dueDate: todayStr,
          estimatedHours: 1,
          completed: false,
          type: 'reading',
        }),
        createItem({
          id: 'run-2',
          title: 'Task B',
          dueDate: todayStr,
          estimatedHours: 1,
          completed: false,
          type: 'quiz',
        }),
      ];

      renderDashboard(items);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
      expect(updateSpy.mock.calls[0][2].id).toBe('run-1');
      expect(updateSpy.mock.calls[0][2].completed).toBe(true);
    });
  });
});
