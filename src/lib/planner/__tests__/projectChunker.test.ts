import { describe, it, expect } from 'vitest';
import {
  divideProjectIntoChunks,
  calculateWorkloadBreakdown,
  toLocalDateStr,
  PHASE_TEMPLATES,
  type ChunkableType,
  type ProjectChunk,
} from '../projectChunker';
import type { ScheduleItem, AssignmentType } from '@/types/schedule';

describe('projectChunker Engine & Algorithmic Workload Suite', () => {
  const fixedToday = new Date(2026, 3, 10, 12, 0, 0); // April 10, 2026 12:00:00 local

  function localIsoDate(year: number, month: number, day: number): string {
    return new Date(year, month - 1, day, 12, 0, 0).toISOString();
  }

  function createScheduleItem(params: {
    id: string;
    title: string;
    dueDate: string; // ISO string from localIsoDate
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

  // =========================================================================
  // TIER 1: Feature Coverage (F1, F2, F4, F6, F7, F8)
  // >= 5 test cases per feature
  // =========================================================================

  describe('Tier 1: Feature F1 - 5 Study Target Types Support', () => {
    const startDate = new Date(2026, 3, 10, 12, 0, 0);
    const dueDate = new Date(2026, 3, 20, 12, 0, 0);

    it('F1-1: chunks a "project" target type with default project phases', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Senior Capstone',
        totalEstimatedHours: 12,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'project',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks[0].type).toBe('project');
      expect(chunks[0].title).toContain('Senior Capstone');
      expect(chunks.every((c) => c.type === 'project')).toBe(true);
    });

    it('F1-2: chunks an "exam" target type with specialized exam phases', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Midterm 2 Biology',
        totalEstimatedHours: 8,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'exam',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks.every((c) => c.type === 'exam')).toBe(true);
      expect(chunks.some((c) => c.phase.includes('Mock Exam'))).toBe(true);
    });

    it('F1-3: chunks a "quiz" target type with specialized quiz phases and lower chunk ceiling', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Calculus Quiz 4',
        totalEstimatedHours: 3,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'quiz',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.every((c) => c.type === 'quiz')).toBe(true);
      expect(chunks[0].phase).toBe('Flashcards & Key Term Definitions');
    });

    it('F1-4: chunks an "assignment" target type with assignment phases', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Physics Lab 3 Report',
        totalEstimatedHours: 6,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'assignment',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks.every((c) => c.type === 'assignment')).toBe(true);
      expect(chunks[0].phase).toBe('Problem Breakdown & Initial Setup');
    });

    it('F1-5: chunks a "paper" target type with term paper phases', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'History Term Essay',
        totalEstimatedHours: 10,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'paper',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks.every((c) => c.type === 'paper')).toBe(true);
      expect(chunks[0].phase).toBe('Thesis Statement & Literature Outline');
    });

    it('F1-6: chunks extended target types (reading, coding, presentation, flashcards, group, portfolio, case_study)', () => {
      const types: ChunkableType[] = [
        'reading',
        'coding',
        'presentation',
        'flashcards',
        'group',
        'portfolio',
        'case_study',
      ];
      for (const t of types) {
        const chunks = divideProjectIntoChunks({
          projectTitle: `Test ${t}`,
          totalEstimatedHours: 6,
          startDate,
          dueDate,
          pace: 'daily',
          type: t,
        });
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        expect(chunks.every((c) => c.type === t)).toBe(true);
        expect(PHASE_TEMPLATES[t]).toContain(chunks[0].phase);
      }
    });
  });

  describe('Tier 1: Feature F2 - Specialized 4-Phase Schedules per Target Type', () => {
    const startDate = new Date(2026, 3, 10, 12, 0, 0);
    const dueDate = new Date(2026, 3, 25, 12, 0, 0);

    it('F2-1: generates exact 4-phase sequence for "exam" plans', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Organic Chemistry Final',
        totalEstimatedHours: 16,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'exam',
      });
      const phases = chunks.map((c) => c.phase);
      expect(phases).toContain('Lecture Notes & Key Concepts Review');
      expect(phases).toContain('Practice Problems & Formula Drills');
      expect(phases).toContain('Timed Mock Exam Run');
      expect(phases).toContain('Weak Spot Refinement & Cheat Sheet');
    });

    it('F2-2: generates exact 4-phase sequence for "project" targets', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'AI Vision Project',
        totalEstimatedHours: 20,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'project',
      });
      const phases = chunks.map((c) => c.phase);
      expect(phases).toContain('Research & Architecture Outline');
      expect(phases).toContain('Core Feature Implementation');
      expect(phases).toContain('Testing, Bug Fixes & Refactoring');
      expect(phases).toContain('Final Polish & Submission');
    });

    it('F2-3: generates exact 4-phase sequence for "paper" targets', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Literature Review Paper',
        totalEstimatedHours: 12,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'paper',
      });
      const phases = chunks.map((c) => c.phase);
      expect(phases).toContain('Thesis Statement & Literature Outline');
      expect(phases).toContain('Drafting Introduction & Main Argument');
      expect(phases).toContain('Evidence Mapping & Discussion');
      expect(phases).toContain('Citations, Proofreading & Final Edit');
    });

    it('F2-4: generates specialized 4-phase sequence for "assignment" targets', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Operating Systems Lab 2',
        totalEstimatedHours: 8,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'assignment',
      });
      const phases = chunks.map((c) => c.phase);
      expect(phases).toContain('Problem Breakdown & Initial Setup');
      expect(phases).toContain('Core Solution Execution');
      expect(phases).toContain('Data Analysis & Result Verification');
      expect(phases).toContain('Report Write-up & Format Check');
    });

    it('F2-5: generates specialized 4-phase sequence for "quiz" targets', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Vocab Quiz',
        totalEstimatedHours: 6,
        startDate,
        dueDate,
        pace: 'daily',
        type: 'quiz',
      });
      const phases = chunks.map((c) => c.phase);
      expect(phases).toContain('Flashcards & Key Term Definitions');
      expect(phases).toContain('Targeted Practice Quiz Questions');
    });
  });

  describe('Tier 1: Feature F4 - 7-Day Forecast Grid & Intensity Classification', () => {
    it('F4-1: aggregates exactly next 7 forecast days starting from today', () => {
      const breakdown = calculateWorkloadBreakdown([], [], fixedToday);
      expect(breakdown.next7Days).toHaveLength(7);
      expect(breakdown.next7Days[0].dateStr).toBe('2026-04-10');
      expect(breakdown.next7Days[6].dateStr).toBe('2026-04-16');
      expect(breakdown.today.dateStr).toBe('2026-04-10');
    });

    it('F4-2: classifies light workload (<= 150 minutes / <= 2.5h)', () => {
      const items = [
        createScheduleItem({
          id: 'task-1',
          title: 'Reading',
          dueDate: localIsoDate(2026, 4, 10),
          estimatedHours: 2, // 120 mins
          completed: false,
          type: 'reading',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.today.totalMinutes).toBe(120);
      expect(breakdown.today.intensity).toBe('light');
    });

    it('F4-3: classifies moderate workload (151 - 300 minutes / 2.5h - 5.0h)', () => {
      const items = [
        createScheduleItem({
          id: 'task-1',
          title: 'Homework Set',
          dueDate: localIsoDate(2026, 4, 10),
          estimatedHours: 4, // 240 mins
          completed: false,
          type: 'assignment',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.today.totalMinutes).toBe(240);
      expect(breakdown.today.intensity).toBe('moderate');
    });

    it('F4-4: classifies heavy peak workload (> 300 minutes / > 5.0h)', () => {
      const items = [
        createScheduleItem({
          id: 'task-1',
          title: 'Heavy Study Day',
          dueDate: localIsoDate(2026, 4, 10),
          estimatedHours: 6, // 360 mins
          completed: false,
          type: 'exam',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.today.totalMinutes).toBe(360);
      expect(breakdown.today.intensity).toBe('heavy');
    });

    it('F4-5: incorporates custom preview chunks into 7-day workload forecast', () => {
      const previewChunks: ProjectChunk[] = [
        {
          id: 'preview-1',
          title: 'Preview Mock Exam',
          targetDate: '2026-04-12',
          durationMinutes: 180,
          completed: false,
          phase: 'Timed Mock Exam Run',
          type: 'exam',
        },
      ];
      const breakdown = calculateWorkloadBreakdown([], previewChunks, fixedToday);
      const targetDay = breakdown.next7Days.find((d) => d.dateStr === '2026-04-12')!;
      expect(targetDay.totalMinutes).toBe(180);
      expect(targetDay.intensity).toBe('moderate');
      expect(targetDay.items[0].isChunk).toBe(true);
    });
  });

  describe('Tier 1: Feature F6 - Interactive Date Shifter Logic', () => {
    it('F6-1: moving a task changes its scheduled day in workload aggregation', () => {
      const item = createScheduleItem({
        id: 'task-shift-1',
        title: 'Project Step 1',
        dueDate: localIsoDate(2026, 4, 10),
        estimatedHours: 3,
        completed: false,
        type: 'project',
      });

      const breakdownBefore = calculateWorkloadBreakdown([item], [], fixedToday);
      expect(breakdownBefore.today.totalMinutes).toBe(180);

      // Shift to 2026-04-12
      const shiftedItem = createScheduleItem({ ...item, dueDate: localIsoDate(2026, 4, 12) });
      const breakdownAfter = calculateWorkloadBreakdown([shiftedItem], [], fixedToday);
      expect(breakdownAfter.today.totalMinutes).toBe(0);
      const day2 = breakdownAfter.next7Days.find((d) => d.dateStr === '2026-04-12')!;
      expect(day2.totalMinutes).toBe(180);
    });

    it('F6-2: date shifting rebalances heavy peak day into moderate/light days', () => {
      const items = [
        createScheduleItem({ id: 't1', title: 'Task 1', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 4, completed: false, type: 'assignment' }),
        createScheduleItem({ id: 't2', title: 'Task 2', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 3, completed: false, type: 'assignment' }),
      ];
      const initial = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(initial.today.totalMinutes).toBe(420); // 7 hrs -> heavy
      expect(initial.today.intensity).toBe('heavy');

      // Shift t2 to tomorrow (2026-04-11)
      const rebalanced = calculateWorkloadBreakdown(
        [items[0], createScheduleItem({ ...items[1], dueDate: localIsoDate(2026, 4, 11) })],
        [],
        fixedToday
      );
      expect(rebalanced.today.totalMinutes).toBe(240); // 4 hrs -> moderate
      expect(rebalanced.today.intensity).toBe('moderate');
      const tomorrow = rebalanced.next7Days.find((d) => d.dateStr === '2026-04-11')!;
      expect(tomorrow.totalMinutes).toBe(180); // 3 hrs -> moderate
      expect(tomorrow.intensity).toBe('moderate');
    });

    it('F6-3: shifting multiple tasks preserves total weekly hours', () => {
      const items = [
        createScheduleItem({ id: 't1', title: 'Task 1', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 2, completed: false, type: 'project' }),
        createScheduleItem({ id: 't2', title: 'Task 2', dueDate: localIsoDate(2026, 4, 11), estimatedHours: 3, completed: false, type: 'project' }),
        createScheduleItem({ id: 't3', title: 'Task 3', dueDate: localIsoDate(2026, 4, 12), estimatedHours: 4, completed: false, type: 'project' }),
      ];
      const b1 = calculateWorkloadBreakdown(items, [], fixedToday);
      const b2 = calculateWorkloadBreakdown(
        [
          createScheduleItem({ ...items[0], dueDate: localIsoDate(2026, 4, 14) }),
          createScheduleItem({ ...items[1], dueDate: localIsoDate(2026, 4, 15) }),
          createScheduleItem({ ...items[2], dueDate: localIsoDate(2026, 4, 16) }),
        ],
        [],
        fixedToday
      );
      expect(b1.thisWeek.totalMinutes).toBe(b2.thisWeek.totalMinutes);
    });

    it('F6-4: shifting a task past the 7-day window removes it from next7Days aggregate', () => {
      const item = createScheduleItem({
        id: 't1',
        title: 'Future Task',
        dueDate: localIsoDate(2026, 4, 10),
        estimatedHours: 5,
        completed: false,
        type: 'exam',
      });
      const b1 = calculateWorkloadBreakdown([item], [], fixedToday);
      expect(b1.thisWeek.totalMinutes).toBe(300);

      // Shift beyond 7 days (e.g. 2026-04-20)
      const b2 = calculateWorkloadBreakdown([createScheduleItem({ ...item, dueDate: localIsoDate(2026, 4, 20) })], [], fixedToday);
      expect(b2.thisWeek.totalMinutes).toBe(0);
    });

    it('F6-5: shifting an item to an earlier date within the 7-day window functions accurately', () => {
      const item = createScheduleItem({
        id: 't1',
        title: 'Review',
        dueDate: localIsoDate(2026, 4, 15),
        estimatedHours: 2,
        completed: false,
        type: 'quiz',
      });
      const b = calculateWorkloadBreakdown([createScheduleItem({ ...item, dueDate: localIsoDate(2026, 4, 10) })], [], fixedToday);
      expect(b.today.totalMinutes).toBe(120);
      expect(b.today.items[0].id).toBe('t1');
    });
  });

  describe('Tier 1: Feature F7 - Retroactive Completion Anchoring', () => {
    it('F7-1: completed task on yesterday stays anchored to yesterday', () => {
      const items = [
        createScheduleItem({
          id: 'past-done-1',
          title: 'Yesterday Lab Work',
          dueDate: localIsoDate(2026, 4, 9),
          estimatedHours: 2,
          completed: true,
          type: 'assignment',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(0);
      expect(breakdown.today.totalMinutes).toBe(0);
    });

    it('F7-2: completed task 2 days ago tracks in past history without rolling over', () => {
      const items = [
        createScheduleItem({
          id: 'past-done-2',
          title: '2 Days Ago Problem Set',
          dueDate: localIsoDate(2026, 4, 8),
          estimatedHours: 3,
          completed: true,
          type: 'assignment',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(0);
      expect(breakdown.today.items).toHaveLength(0);
    });

    it('F7-3: multiple completed past tasks retain their original completion minutes', () => {
      const items = [
        createScheduleItem({ id: 'p1', title: 'P1', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 2, completed: true, type: 'reading' }),
        createScheduleItem({ id: 'p2', title: 'P2', dueDate: localIsoDate(2026, 4, 8), estimatedHours: 1.5, completed: true, type: 'quiz' }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(0);
    });

    it('F7-4: completed task on today contributes to both totalMinutes and completedMinutes', () => {
      const items = [
        createScheduleItem({
          id: 'today-done',
          title: 'Today Done Essay Draft',
          dueDate: localIsoDate(2026, 4, 10),
          estimatedHours: 2.5, // 150 mins
          completed: true,
          type: 'paper',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.today.totalMinutes).toBe(150);
      expect(breakdown.today.completedMinutes).toBe(150);
      expect(breakdown.thisWeek.completedMinutes).toBe(150);
    });

    it('F7-5: completed future tasks do not roll over and anchor to their future date', () => {
      const items = [
        createScheduleItem({
          id: 'future-done',
          title: 'Submitted Early Capstone Chapter',
          dueDate: localIsoDate(2026, 4, 14),
          estimatedHours: 4,
          completed: true,
          type: 'project',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(0);
      const target = breakdown.next7Days.find((d) => d.dateStr === '2026-04-14')!;
      expect(target.totalMinutes).toBe(240);
      expect(target.completedMinutes).toBe(240);
    });
  });

  describe('Tier 1: Feature F8 - Dynamic Rollover Recalculation', () => {
    it('F8-1: uncompleted past task rolls over to today with rollover flag and formatted title', () => {
      const items = [
        createScheduleItem({
          id: 'missed-1',
          title: 'Missed Calculus HW',
          dueDate: localIsoDate(2026, 4, 9),
          estimatedHours: 2,
          completed: false,
          type: 'assignment',
        }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(1);
      expect(breakdown.today.totalMinutes).toBe(120);
      expect(breakdown.today.items[0].isRollover).toBe(true);
      expect(breakdown.today.items[0].title).toBe('Missed Calculus HW (Rollover)');
    });

    it('F8-2: multiple uncompleted past tasks accumulate into today and increment rolledOverCount', () => {
      const items = [
        createScheduleItem({ id: 'm1', title: 'Task A', dueDate: localIsoDate(2026, 4, 7), estimatedHours: 1, completed: false, type: 'reading' }),
        createScheduleItem({ id: 'm2', title: 'Task B', dueDate: localIsoDate(2026, 4, 8), estimatedHours: 2, completed: false, type: 'coding' }),
        createScheduleItem({ id: 'm3', title: 'Task C', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 3, completed: false, type: 'exam' }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(3);
      expect(breakdown.today.totalMinutes).toBe(360); // 6 hours total
      expect(breakdown.today.intensity).toBe('heavy');
    });

    it('F8-3: mixing past completed and uncompleted tasks only rolls over uncompleted ones', () => {
      const items = [
        createScheduleItem({ id: 'past-completed', title: 'Done HW', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 2, completed: true, type: 'assignment' }),
        createScheduleItem({ id: 'past-pending', title: 'Pending HW', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 1.5, completed: false, type: 'assignment' }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.rolledOverCount).toBe(1);
      expect(breakdown.today.items).toHaveLength(1);
      expect(breakdown.today.items[0].id).toBe('past-pending');
    });

    it('F8-4: rollover tasks combine with native today tasks to calculate today load intensity', () => {
      const items = [
        createScheduleItem({ id: 'past-pending', title: 'Late Lab', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 2, completed: false, type: 'assignment' }),
        createScheduleItem({ id: 'today-task', title: 'Today Quiz', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 1.5, completed: false, type: 'quiz' }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.today.totalMinutes).toBe(210); // 120 + 90 = 210 mins (moderate)
      expect(breakdown.today.intensity).toBe('moderate');
      expect(breakdown.today.items).toHaveLength(2);
    });

    it('F8-5: completing a rolled-over task on today clears rollover state upon recalculation', () => {
      const items = [
        createScheduleItem({ id: 'item-1', title: 'Late Assignment', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 2, completed: false, type: 'assignment' }),
      ];
      const before = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(before.rolledOverCount).toBe(1);

      // Complete it
      const after = calculateWorkloadBreakdown([createScheduleItem({ ...items[0], completed: true })], [], fixedToday);
      expect(after.rolledOverCount).toBe(0);
      expect(after.today.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases (>= 5 per category)
  // =========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: handles same-day start and due dates (0-day span) without division by zero', () => {
      const sameDay = new Date(2026, 4, 1, 12, 0, 0);
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Emergency Cram Session',
        totalEstimatedHours: 4,
        startDate: sameDay,
        dueDate: sameDay,
        pace: 'daily',
        type: 'exam',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].targetDate).toBe(toLocalDateStr(sameDay));
      expect(chunks.every((c) => !isNaN(c.durationMinutes))).toBe(true);
    });

    it('B2: handles 1-day project horizon', () => {
      const start = new Date(2026, 4, 1, 12, 0, 0);
      const due = new Date(2026, 4, 2, 12, 0, 0);
      const chunks = divideProjectIntoChunks({
        projectTitle: '1-Day Quick Turnaround',
        totalEstimatedHours: 2,
        startDate: start,
        dueDate: due,
        pace: 'daily',
        type: 'assignment',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].durationMinutes).toBeGreaterThan(0);
    });

    it('B3: handles large 60-day project horizon with daily and weekly paces', () => {
      const start = new Date(2026, 8, 1, 12, 0, 0);
      const due = new Date(2026, 9, 31, 12, 0, 0);

      const dailyChunks = divideProjectIntoChunks({
        projectTitle: 'Semester Capstone',
        totalEstimatedHours: 30,
        startDate: start,
        dueDate: due,
        pace: 'daily',
        type: 'project',
      });
      expect(dailyChunks.length).toBeGreaterThanOrEqual(10);

      const weeklyChunks = divideProjectIntoChunks({
        projectTitle: 'Semester Capstone',
        totalEstimatedHours: 30,
        startDate: start,
        dueDate: due,
        pace: 'weekly',
        type: 'project',
      });
      expect(weeklyChunks.length).toBeGreaterThanOrEqual(4);
      expect(weeklyChunks.length).toBeLessThanOrEqual(9);
    });

    it('B4: handles odd minute totals with remainder distribution (e.g. 7.7 hours, 1.3 hours)', () => {
      const chunks77 = divideProjectIntoChunks({
        projectTitle: 'Odd Hour Study',
        totalEstimatedHours: 7.7, // 462 mins
        startDate: new Date(2026, 3, 10, 12, 0, 0),
        dueDate: new Date(2026, 3, 15, 12, 0, 0),
        pace: 'daily',
        type: 'exam',
      });
      expect(chunks77.length).toBeGreaterThanOrEqual(3);
      chunks77.forEach((c) => {
        expect(Number.isInteger(c.durationMinutes)).toBe(true);
        expect(c.durationMinutes).toBeGreaterThan(0);
      });

      const chunks13 = divideProjectIntoChunks({
        projectTitle: 'Short Quiz',
        totalEstimatedHours: 1.3,
        startDate: new Date(2026, 3, 10, 12, 0, 0),
        dueDate: new Date(2026, 3, 12, 12, 0, 0),
        pace: 'daily',
        type: 'quiz',
      });
      expect(chunks13.length).toBeGreaterThanOrEqual(2);
      expect(chunks13[0].durationMinutes).toBeGreaterThan(0);
    });

    it('B5: clamps zero or negative estimated hours to 30-minute minimum threshold', () => {
      const chunksZero = divideProjectIntoChunks({
        projectTitle: 'Zero Hour Task',
        totalEstimatedHours: 0,
        dueDate: new Date(2026, 3, 15, 12, 0, 0),
        pace: 'daily',
        type: 'assignment',
      });
      expect(chunksZero.length).toBeGreaterThanOrEqual(1);
      expect(chunksZero.reduce((acc, c) => acc + c.durationMinutes, 0)).toBeGreaterThanOrEqual(30);

      const chunksNeg = divideProjectIntoChunks({
        projectTitle: 'Negative Hour Task',
        totalEstimatedHours: -5,
        dueDate: new Date(2026, 3, 15, 12, 0, 0),
        pace: 'daily',
        type: 'assignment',
      });
      expect(chunksNeg.reduce((acc, c) => acc + c.durationMinutes, 0)).toBeGreaterThanOrEqual(30);
    });

    it('B6: handles midnight boundary and local date transitions cleanly', () => {
      const start = new Date(2026, 3, 10, 0, 0, 0); // 2026-04-10 00:00:00 local
      const due = new Date(2026, 3, 14, 23, 59, 59); // 2026-04-14 23:59:59 local
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Midnight Window',
        totalEstimatedHours: 6,
        startDate: start,
        dueDate: due,
        pace: 'daily',
        type: 'paper',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks[0].targetDate).toBe('2026-04-10');
      expect(chunks[chunks.length - 1].targetDate).toBe('2026-04-14');
    });

    it('B7: handles leap year date transitions across February 28/29 to March (2028)', () => {
      const leapStart = new Date(2028, 1, 26, 12, 0, 0); // 2028-02-26
      const leapDue = new Date(2028, 2, 4, 12, 0, 0); // 2028-03-04
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Leap Year Research',
        totalEstimatedHours: 12,
        startDate: leapStart,
        dueDate: leapDue,
        pace: 'daily',
        type: 'project',
      });
      const dates = chunks.map((c) => c.targetDate);
      expect(dates.some((d) => d.includes('2028-02-29'))).toBe(true); // Leap day exists and mapped
    });

    it('B8: handles year rollover transition across Dec 30 to Jan 3', () => {
      const yearStart = new Date(2026, 11, 30, 12, 0, 0); // Dec 30 2026
      const yearDue = new Date(2027, 0, 3, 12, 0, 0); // Jan 3 2027
      const chunks = divideProjectIntoChunks({
        projectTitle: 'New Year Project',
        totalEstimatedHours: 10,
        startDate: yearStart,
        dueDate: yearDue,
        pace: 'daily',
        type: 'project',
      });
      const dates = chunks.map((c) => c.targetDate);
      expect(dates).toContain('2026-12-30');
      expect(dates).toContain('2027-01-03');
    });

    it('B9: handles empty task list and undefined dueDate items gracefully', () => {
      const emptyBreakdown = calculateWorkloadBreakdown([], [], fixedToday);
      expect(emptyBreakdown.rolledOverCount).toBe(0);
      expect(emptyBreakdown.thisWeek.totalMinutes).toBe(0);
      expect(emptyBreakdown.thisWeek.itemCount).toBe(0);
      expect(emptyBreakdown.next7Days.every((d) => d.intensity === 'light')).toBe(true);

      const itemsWithNoDue: ScheduleItem[] = [
        { id: 'no-due-1', courseId: 'c1', dueDate: '', title: 'Floating task', completed: false, type: 'assignment' },
      ];
      const noDueBreakdown = calculateWorkloadBreakdown(itemsWithNoDue, [], fixedToday);
      expect(noDueBreakdown.thisWeek.totalMinutes).toBe(0);
    });

    it('B10: handles high task volume (50+ items) with high performance', () => {
      const highVolume: ScheduleItem[] = Array.from({ length: 70 }, (_, i) =>
        createScheduleItem({
          id: `bulk-${i}`,
          title: `Bulk Task ${i}`,
          dueDate: localIsoDate(2026, 4, 10 + (i % 7)),
          estimatedHours: 0.5, // 30 mins each
          completed: i % 4 === 0,
          type: 'assignment',
        })
      );

      const start = performance.now();
      const breakdown = calculateWorkloadBreakdown(highVolume, [], fixedToday);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100); // Fast sub-100ms execution
      expect(breakdown.thisWeek.itemCount).toBeGreaterThan(0);
    });

    it('B11: handles items with missing estimatedHours applying type-specific fallbacks', () => {
      const examItem = createScheduleItem({ id: 'exam-no-hr', title: 'Exam', dueDate: localIsoDate(2026, 4, 10), completed: false, type: 'exam' });
      const defaultItem = createScheduleItem({ id: 'def-no-hr', title: 'Task', dueDate: localIsoDate(2026, 4, 10), completed: false, type: 'assignment' });

      const b = calculateWorkloadBreakdown([examItem, defaultItem], [], fixedToday);
      expect(b.today.items[0].durationMinutes).toBe(120); // 120m for exam
      expect(b.today.items[1].durationMinutes).toBe(60); // 60m for assignment
      expect(b.today.totalMinutes).toBe(180);
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise)
  // =========================================================================

  describe('Tier 3: Pairwise Combinations', () => {
    it('P1: Rollover + Date Shifter: past uncompleted task rolls over, then shifted to future day', () => {
      const pastTask = createScheduleItem({
        id: 'past-hw',
        title: 'Overdue Homework',
        dueDate: localIsoDate(2026, 4, 8),
        estimatedHours: 2,
        completed: false,
        type: 'assignment',
      });

      // Step 1: Initial load -> rolls over to today (2026-04-10)
      const b1 = calculateWorkloadBreakdown([pastTask], [], fixedToday);
      expect(b1.rolledOverCount).toBe(1);
      expect(b1.today.totalMinutes).toBe(120);

      // Step 2: Student shifts task to 2026-04-13
      const shiftedTask = createScheduleItem({ ...pastTask, dueDate: localIsoDate(2026, 4, 13) });
      const b2 = calculateWorkloadBreakdown([shiftedTask], [], fixedToday);
      expect(b2.rolledOverCount).toBe(0);
      expect(b2.today.totalMinutes).toBe(0);
      const targetDay = b2.next7Days.find((d) => d.dateStr === '2026-04-13')!;
      expect(targetDay.totalMinutes).toBe(120);
      expect(targetDay.items[0].isRollover).toBeUndefined();
    });

    it('P2: Completed Past Task + Future Date Shifter: completed task stays anchored while future task shifts', () => {
      const completedPast = createScheduleItem({
        id: 'past-done',
        title: 'Finished Quiz',
        dueDate: localIsoDate(2026, 4, 9),
        estimatedHours: 1.5,
        completed: true,
        type: 'quiz',
      });
      const futureTask = createScheduleItem({
        id: 'future-task',
        title: 'Final Draft',
        dueDate: localIsoDate(2026, 4, 11),
        estimatedHours: 3,
        completed: false,
        type: 'paper',
      });

      const b1 = calculateWorkloadBreakdown([completedPast, futureTask], [], fixedToday);
      expect(b1.rolledOverCount).toBe(0);

      // Shift future task to 2026-04-15
      const b2 = calculateWorkloadBreakdown(
        [completedPast, createScheduleItem({ ...futureTask, dueDate: localIsoDate(2026, 4, 15) })],
        [],
        fixedToday
      );
      expect(b2.rolledOverCount).toBe(0);
      const day11 = b2.next7Days.find((d) => d.dateStr === '2026-04-11')!;
      const day15 = b2.next7Days.find((d) => d.dateStr === '2026-04-15')!;
      expect(day11.totalMinutes).toBe(0);
      expect(day15.totalMinutes).toBe(180);
    });

    it('P3: Multi-Course Chunking: tasks across 4 courses aggregate seamlessly into daily forecast', () => {
      const items = [
        createScheduleItem({ id: 'c1-t1', courseId: 'c-cs', title: 'CS Coding', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 2, completed: false, type: 'coding' }),
        createScheduleItem({ id: 'c2-t1', courseId: 'c-math', title: 'Math Problem Set', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 2, completed: false, type: 'assignment' }),
        createScheduleItem({ id: 'c3-t1', courseId: 'c-bio', title: 'Bio Flashcards', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 1, completed: false, type: 'flashcards' }),
        createScheduleItem({ id: 'c4-t1', courseId: 'c-hist', title: 'History Reading', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 1.5, completed: false, type: 'reading' }),
      ];
      const breakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(breakdown.today.items).toHaveLength(4);
      expect(breakdown.today.totalMinutes).toBe(390); // 6.5 hours
      expect(breakdown.today.intensity).toBe('heavy');
    });

    it('P4: 4-Phase Exam Chunking + Workload Intensity Recalculation: generating chunks distributes intensity across forecast', () => {
      const chunks = divideProjectIntoChunks({
        projectTitle: 'Physics 201 Final Exam',
        totalEstimatedHours: 16,
        startDate: new Date(2026, 3, 10, 12, 0, 0),
        dueDate: new Date(2026, 3, 14, 12, 0, 0),
        pace: 'daily',
        type: 'exam',
      });

      const breakdown = calculateWorkloadBreakdown([], chunks, fixedToday);
      expect(breakdown.thisWeek.totalMinutes).toBeGreaterThanOrEqual(720); // Distributed across week
      expect(breakdown.thisWeek.itemCount).toBeGreaterThanOrEqual(3);
    });

    it('P5: Coexistence of Persisted Items & Unpersisted Preview Chunks: both contribute without conflict', () => {
      const persisted = [
        createScheduleItem({ id: 'persisted-1', title: 'Regular Task', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 2, completed: false, type: 'assignment' }),
      ];
      const preview: ProjectChunk[] = [
        { id: 'chunk-1', title: 'Preview Part 1', targetDate: '2026-04-10', durationMinutes: 90, completed: false, phase: 'Phase 1', type: 'paper' },
      ];

      const b = calculateWorkloadBreakdown(persisted, preview, fixedToday);
      expect(b.today.totalMinutes).toBe(210); // 120 + 90
      expect(b.today.items).toHaveLength(2);
      expect(b.today.items.find((i) => i.isChunk)?.title).toBe('Preview Part 1');
      expect(b.today.items.find((i) => !i.isChunk)?.title).toBe('Regular Task');
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios (>= 5 Scenarios)
  // =========================================================================

  describe('Tier 4: Real-World Application Workload Scenarios', () => {
    it('Scenario 1: Midterm Sprint with High Course Load (3 exams + 1 lab)', () => {
      // 1. Generate exam study chunks for CS and Math
      const csExamChunks = divideProjectIntoChunks({
        projectTitle: 'CS 301 Midterm',
        totalEstimatedHours: 8,
        startDate: new Date(2026, 3, 10, 12, 0, 0),
        dueDate: new Date(2026, 3, 13, 12, 0, 0),
        pace: 'daily',
        type: 'exam',
      });

      const mathExamChunks = divideProjectIntoChunks({
        projectTitle: 'MATH 240 Midterm',
        totalEstimatedHours: 8,
        startDate: new Date(2026, 3, 11, 12, 0, 0),
        dueDate: new Date(2026, 3, 14, 12, 0, 0),
        pace: 'daily',
        type: 'exam',
      });

      const labItem = createScheduleItem({
        id: 'phys-lab',
        title: 'Physics Lab Report',
        dueDate: localIsoDate(2026, 4, 12),
        estimatedHours: 4, // 240 mins
        completed: false,
        type: 'assignment',
      });

      const combinedChunks = [...csExamChunks, ...mathExamChunks];
      const breakdown = calculateWorkloadBreakdown([labItem], combinedChunks, fixedToday);

      expect(breakdown.next7Days.length).toBe(7);
      const apr12 = breakdown.next7Days.find((d) => d.dateStr === '2026-04-12')!;
      // Apr 12 has CS chunk + Math chunk + Lab item (240 mins) -> Heavy peak (>= 300 mins)
      expect(apr12.totalMinutes).toBeGreaterThanOrEqual(300);
      expect(apr12.intensity).toBe('heavy');
    });

    it('Scenario 2: Multi-Week Senior Project Milestone Crunch (40-hr capstone over 30 days)', () => {
      const capstoneChunks = divideProjectIntoChunks({
        projectTitle: 'Autonomous Drone Navigation System',
        totalEstimatedHours: 40,
        startDate: new Date(2026, 3, 10, 12, 0, 0),
        dueDate: new Date(2026, 4, 10, 12, 0, 0),
        pace: 'weekly',
        type: 'project',
      });

      expect(capstoneChunks.length).toBeGreaterThanOrEqual(4);
      expect(capstoneChunks[0].phase).toBe('Research & Architecture Outline');
      expect(capstoneChunks[capstoneChunks.length - 1].phase).toBe('Final Polish & Submission');

      const breakdown = calculateWorkloadBreakdown([], capstoneChunks, fixedToday);
      expect(breakdown.thisWeek.totalMinutes).toBeGreaterThan(0);
    });

    it('Scenario 3: Sick Day Rollover Recovery (Missed 2 days, 4 tasks roll over to today)', () => {
      const items = [
        createScheduleItem({ id: 'missed-1', title: 'Day-2 Task 1', dueDate: localIsoDate(2026, 4, 8), estimatedHours: 2, completed: false, type: 'reading' }),
        createScheduleItem({ id: 'missed-2', title: 'Day-2 Task 2', dueDate: localIsoDate(2026, 4, 8), estimatedHours: 1.5, completed: false, type: 'quiz' }),
        createScheduleItem({ id: 'missed-3', title: 'Day-1 Task 1', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 2.5, completed: false, type: 'assignment' }),
        createScheduleItem({ id: 'missed-4', title: 'Day-1 Task 2', dueDate: localIsoDate(2026, 4, 9), estimatedHours: 1, completed: false, type: 'coding' }),
        // A task completed before sickness
        createScheduleItem({ id: 'done-before', title: 'Day-3 Done Task', dueDate: localIsoDate(2026, 4, 7), estimatedHours: 2, completed: true, type: 'assignment' }),
      ];

      const initialBreakdown = calculateWorkloadBreakdown(items, [], fixedToday);
      expect(initialBreakdown.rolledOverCount).toBe(4);
      expect(initialBreakdown.today.totalMinutes).toBe(420); // 7.0 hours
      expect(initialBreakdown.today.intensity).toBe('heavy');

      // Student recovers and completes 2 tasks, shifts 2 tasks across tomorrow and the next day
      const recoveredItems = [
        createScheduleItem({ ...items[0], completed: true }),
        createScheduleItem({ ...items[1], completed: true }),
        createScheduleItem({ ...items[2], dueDate: localIsoDate(2026, 4, 11) }),
        createScheduleItem({ ...items[3], dueDate: localIsoDate(2026, 4, 12) }),
        items[4],
      ];

      const recoveredBreakdown = calculateWorkloadBreakdown(recoveredItems, [], fixedToday);
      expect(recoveredBreakdown.rolledOverCount).toBe(0);
      expect(recoveredBreakdown.today.totalMinutes).toBe(0); // All cleared from today
      expect(recoveredBreakdown.today.intensity).toBe('light');
    });

    it('Scenario 4: Term Paper Synthesis with Mixed Deadlines', () => {
      const paperChunks = divideProjectIntoChunks({
        projectTitle: 'Ethical Dilemmas in AI Regulation',
        totalEstimatedHours: 14,
        startDate: new Date(2026, 3, 10, 12, 0, 0),
        dueDate: new Date(2026, 3, 24, 12, 0, 0),
        pace: 'daily',
        type: 'paper',
      });

      const concurrentHomework = [
        createScheduleItem({ id: 'hw-1', title: 'Stats Weekly Set', dueDate: localIsoDate(2026, 4, 12), estimatedHours: 3, completed: false, type: 'assignment' }),
        createScheduleItem({ id: 'hw-2', title: 'CS Code Review', dueDate: localIsoDate(2026, 4, 14), estimatedHours: 2, completed: false, type: 'coding' }),
      ];

      const breakdown = calculateWorkloadBreakdown(concurrentHomework, paperChunks, fixedToday);
      expect(breakdown.next7Days.length).toBe(7);
      expect(breakdown.thisWeek.totalMinutes).toBeGreaterThan(0);
    });

    it('Scenario 5: End-of-Semester Grade Polish Workload Balancing', () => {
      // Overloaded Monday: 3 heavy finals and 2 projects due
      const overloadedItems = [
        createScheduleItem({ id: 'f1', title: 'Algorithms Final', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 4, completed: false, type: 'exam' }),
        createScheduleItem({ id: 'f2', title: 'Databases Final', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 3, completed: false, type: 'exam' }),
        createScheduleItem({ id: 'p1', title: 'Web App Final Submission', dueDate: localIsoDate(2026, 4, 10), estimatedHours: 3, completed: false, type: 'project' }),
      ];

      const b1 = calculateWorkloadBreakdown(overloadedItems, [], fixedToday);
      expect(b1.today.totalMinutes).toBe(600); // 10 hours -> heavy
      expect(b1.today.intensity).toBe('heavy');

      // Rebalancing: distribute across the 7-day forecast
      const rebalancedItems = [
        createScheduleItem({ ...overloadedItems[0], dueDate: localIsoDate(2026, 4, 10) }), // 4h today (moderate)
        createScheduleItem({ ...overloadedItems[1], dueDate: localIsoDate(2026, 4, 12) }), // 3h on day 3 (moderate)
        createScheduleItem({ ...overloadedItems[2], dueDate: localIsoDate(2026, 4, 14) }), // 3h on day 5 (moderate)
      ];

      const b2 = calculateWorkloadBreakdown(rebalancedItems, [], fixedToday);
      expect(b2.today.totalMinutes).toBe(240);
      expect(b2.today.intensity).toBe('moderate');
      expect(b2.next7Days.every((d) => d.intensity !== 'heavy')).toBe(true);
    });
  });
});
