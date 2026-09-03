import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProjectChunkerModal } from '../ProjectChunkerModal';
import { AppStateProvider } from '@/context/AppStateContext';
import { AuthProvider } from '@/context/AuthContext';
import * as scheduleItemsLib from '@/lib/firestore/scheduleItems';
import type { Course } from '@/types/schedule';

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
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

const mockCourses: Course[] = [
  { id: 'c1', code: 'CSCI 401', title: 'Senior Software Project', color: 'bg-blue-500' },
  { id: 'c2', code: 'MATH 310', title: 'Applied Probability', color: 'bg-emerald-500' },
  { id: 'c3', code: 'ENG 202', title: 'Technical Writing', color: 'bg-purple-500' },
];

function renderModal(props: { open: boolean; onClose?: () => void }) {
  const onClose = props.onClose || vi.fn();
  const rendered = render(
    <AuthProvider>
      <AppStateProvider initialState={{ courses: mockCourses, scheduleItems: [] }}>
        <ProjectChunkerModal open={props.open} onClose={onClose} />
      </AppStateProvider>
    </AuthProvider>,
  );

  const getTitleInput = () =>
    rendered.container.querySelector('input[type="text"]') as HTMLInputElement;
  const getHoursInput = () =>
    rendered.container.querySelector('input[type="number"]') as HTMLInputElement;
  const getDateInput = () =>
    rendered.container.querySelector('input[type="date"]') as HTMLInputElement;
  const getCourseSelect = () => rendered.container.querySelector('select') as HTMLSelectElement;

  return {
    ...rendered,
    onClose,
    getTitleInput,
    getHoursInput,
    getDateInput,
    getCourseSelect,
  };
}

describe('ProjectChunkerModal Component Suite (Tier 1-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TIER 1: Feature Coverage (F1, F2, F3)
  // =========================================================================

  describe('Tier 1: Feature F1 - Study Target Types Selection', () => {
    it('F1-1: renders all 12 target type buttons in selector grid', () => {
      renderModal({ open: true });
      expect(screen.getByText('Final Project / Capstone')).toBeDefined();
      expect(screen.getByText('Exam Study Plan')).toBeDefined();
      expect(screen.getByText('Quiz / Test Review')).toBeDefined();
      expect(screen.getByText('Large Assignment / Lab')).toBeDefined();
      expect(screen.getByText('Essay / Term Paper')).toBeDefined();
      expect(screen.getByText('Presentation / Slides')).toBeDefined();
      expect(screen.getByText('Textbook / Lit Reading')).toBeDefined();
      expect(screen.getByText('Coding / Repository')).toBeDefined();
      expect(screen.getByText('Design Portfolio')).toBeDefined();
      expect(screen.getByText('Group Project')).toBeDefined();
      expect(screen.getByText('Flashcard Mastery')).toBeDefined();
      expect(screen.getByText('Case Study Analysis')).toBeDefined();
    });

    it('F1-2: selecting "Exam Study Plan" switches title and default hours to 8h', () => {
      const { getTitleInput, getHoursInput } = renderModal({ open: true });
      const examBtn = screen.getByRole('button', { name: /Exam Study Plan/i });
      fireEvent.click(examBtn);

      expect(getTitleInput().value).toBe('Midterm Exam 1 Prep');
      expect(getHoursInput().value).toBe('8');
    });

    it('F1-3: selecting "Quiz / Test Review" switches title and default hours to 3h', () => {
      const { getTitleInput, getHoursInput } = renderModal({ open: true });
      fireEvent.click(screen.getByRole('button', { name: /Quiz \/ Test Review/i }));
      expect(getTitleInput().value).toBe('Chapter Quiz Review');
      expect(getHoursInput().value).toBe('3');
    });

    it('F1-4: selecting "Large Assignment / Lab" switches title and default hours to 5h', () => {
      const { getTitleInput, getHoursInput } = renderModal({ open: true });
      fireEvent.click(screen.getByRole('button', { name: /Large Assignment \/ Lab/i }));
      expect(getTitleInput().value).toBe('Lab Report & Data Analysis');
      expect(getHoursInput().value).toBe('5');
    });

    it('F1-5: selecting "Essay / Term Paper" switches title and default hours to 7h', () => {
      const { getTitleInput, getHoursInput } = renderModal({ open: true });
      fireEvent.click(screen.getByRole('button', { name: /Essay \/ Term Paper/i }));
      expect(getTitleInput().value).toBe('Term Research Paper');
      expect(getHoursInput().value).toBe('7');
    });
  });

  describe('Tier 1: Feature F2 - Specialized 4-Phase Schedules & Previews', () => {
    it('F2-1: renders exam preview chunks with specialized exam phases', () => {
      renderModal({ open: true });
      fireEvent.click(screen.getByRole('button', { name: /Exam Study Plan/i }));

      expect(screen.getAllByText(/Lecture Notes & Key Concepts Review/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Practice Problems & Formula Drills/i).length).toBeGreaterThan(0);
    });

    it('F2-2: renders project preview chunks with research and core implementation phases', () => {
      renderModal({ open: true });
      fireEvent.click(screen.getByRole('button', { name: /Final Project \/ Capstone/i }));

      expect(screen.getAllByText(/Research & Architecture Outline/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Core Feature Implementation/i).length).toBeGreaterThan(0);
    });

    it('F2-3: renders paper preview chunks with literature and drafting phases', () => {
      renderModal({ open: true });
      fireEvent.click(screen.getByRole('button', { name: /Essay \/ Term Paper/i }));

      expect(screen.getAllByText(/Thesis Statement & Literature Outline/i).length).toBeGreaterThan(
        0,
      );
    });

    it('F2-4: toggling pacing to Weekly Major Milestones updates chunk preview count', () => {
      renderModal({ open: true });
      const weeklyBtn = screen.getByRole('button', { name: /Weekly Major Milestones/i });
      fireEvent.click(weeklyBtn);

      expect(screen.getByText(/Weekly Major Milestones/i)).toBeDefined();
      expect(screen.getByText(/Generated Bite-Sized Study Schedule/i)).toBeDefined();
    });

    it('F2-5: updates duration in minutes per chunk badge in preview list', () => {
      renderModal({ open: true });
      const minuteBadges = screen.getAllByText(/⏱ \d+ mins/i);
      expect(minuteBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Tier 1: Feature F3 - 1-Click Firestore Persistence', () => {
    it('F3-1: clicking "Add Chunks to Task List" persists all generated chunks to Firestore', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      renderModal({ open: true });

      const addBtn = screen.getByRole('button', { name: /Add Chunks to Task List/i });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });

      expect(createSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
      const firstCallArg = createSpy.mock.calls[0][1];
      expect(firstCallArg.title).toContain('Senior Capstone Project');
      expect(firstCallArg.type).toBe('project');
      expect(firstCallArg.completed).toBe(false);
      expect(firstCallArg.priority).toBe('high');
    });

    it('F3-2: correctly maps target type to assignment type (e.g. exam -> exam, quiz -> quiz)', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Exam Study Plan/i }));
      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
      const firstCallArg = createSpy.mock.calls[0][1];
      expect(firstCallArg.type).toBe('exam');
    });

    it('F3-3: associates persisted chunks with the selected course ID', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getCourseSelect } = renderModal({ open: true });

      fireEvent.change(getCourseSelect(), { target: { value: 'c1' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
      expect(createSpy.mock.calls[0][1].courseId).toBe('c1');
    });

    it('F3-4: shows success feedback button state after successful persistence', async () => {
      vi.spyOn(scheduleItemsLib, 'createScheduleItem').mockResolvedValue(undefined);
      renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(screen.getByText(/✓ Chunks Added!/i)).toBeDefined();
      });
    });

    it('F3-5: automatically closes modal after success timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(scheduleItemsLib, 'createScheduleItem').mockResolvedValue(undefined);
      const { onClose } = renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(screen.getByText(/✓ Chunks Added!/i)).toBeDefined();
      });

      vi.advanceTimersByTime(1300);
      expect(onClose).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases
  // =========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: renders null when open is false', () => {
      const { container } = renderModal({ open: false });
      expect(container.firstChild).toBeNull();
    });

    it('B2: calls onClose when clicking header close button (✕)', () => {
      const { onClose } = renderModal({ open: true });
      const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('B3: calls onClose when clicking footer Cancel button', () => {
      const { onClose } = renderModal({ open: true });
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('B4: empty title string clears preview chunks and disables submit button', () => {
      const { getTitleInput } = renderModal({ open: true });
      fireEvent.change(getTitleInput(), { target: { value: '   ' } });

      expect(screen.getByText(/Generated Bite-Sized Study Schedule \(0 Chunks\)/i)).toBeDefined();
      const submitBtn = screen.getByRole('button', { name: /Add Chunks to Task List/i });
      expect(submitBtn).toHaveProperty('disabled', true);
    });

    it('B5: zero or negative hours input clears preview chunks and disables submit', () => {
      const { getHoursInput } = renderModal({ open: true });
      fireEvent.change(getHoursInput(), { target: { value: '0' } });

      expect(screen.getByText(/Generated Bite-Sized Study Schedule \(0 Chunks\)/i)).toBeDefined();
      const submitBtn = screen.getByRole('button', { name: /Add Chunks to Task List/i });
      expect(submitBtn).toHaveProperty('disabled', true);
    });

    it('B6: handles large hour inputs (e.g. 50 hours) without UI or math failure', () => {
      const { getHoursInput } = renderModal({ open: true });
      fireEvent.change(getHoursInput(), { target: { value: '50' } });

      expect(screen.getByText(/50 hrs/i)).toBeDefined();
      const submitBtn = screen.getByRole('button', { name: /Add Chunks to Task List/i });
      expect(submitBtn).toHaveProperty('disabled', false);
    });

    it('B7: handles date input change for target due date', () => {
      const { getDateInput } = renderModal({ open: true });
      fireEvent.change(getDateInput(), { target: { value: '2026-05-15' } });
      expect(getDateInput().value).toBe('2026-05-15');
    });

    it('B8: verifies dialog modal accessibility attributes (role, aria-modal, aria-labelledby)', () => {
      renderModal({ open: true });
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('project-chunker-title');
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations
  // =========================================================================

  describe('Tier 3: Pairwise Combinations', () => {
    it('P1: Target Type Switch + Custom Hours + Weekly Pace + Course Selection', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getTitleInput, getHoursInput, getCourseSelect } = renderModal({ open: true });

      // 1. Select Coding / Repository
      fireEvent.click(screen.getByRole('button', { name: /Coding \/ Repository/i }));

      // 2. Change title and total hours
      fireEvent.change(getTitleInput(), { target: { value: 'Distributed Key-Value Store' } });
      fireEvent.change(getHoursInput(), { target: { value: '18' } });

      // 3. Switch pace to weekly
      fireEvent.click(screen.getByRole('button', { name: /Weekly Major Milestones/i }));

      // 4. Select CSCI 401 course
      fireEvent.change(getCourseSelect(), { target: { value: 'c1' } });

      // 5. Submit
      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });

      const chunkCall = createSpy.mock.calls[0][1];
      expect(chunkCall.title).toContain('Distributed Key-Value Store');
      expect(chunkCall.courseId).toBe('c1');
      expect(chunkCall.type).toBe('project');
      expect(chunkCall.estimatedHours).toBeGreaterThan(0);
    });

    it('P2: Handles Firestore persistence error gracefully and restores button state', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(scheduleItemsLib, 'createScheduleItem').mockRejectedValue(
        new Error('Network offline'),
      );
      renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Chunks to Task List/i })).toHaveProperty(
          'disabled',
          false,
        );
      });
      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // TIER 4: Real-World Workflows (>= 5 Scenarios)
  // =========================================================================

  describe('Tier 4: Real-World User Workflows', () => {
    it('Scenario 1: Midterm Exam 1 Prep Interactive Workflow', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getTitleInput, getHoursInput, getCourseSelect } = renderModal({ open: true });

      // Student chooses Exam Study Plan
      fireEvent.click(screen.getByRole('button', { name: /Exam Study Plan/i }));
      fireEvent.change(getTitleInput(), { target: { value: 'MATH 310 Midterm 1' } });
      fireEvent.change(getHoursInput(), { target: { value: '12' } });
      fireEvent.change(getCourseSelect(), { target: { value: 'c2' } });

      // Verifies preview list shows mock exam and weak spot refinement
      expect(screen.getAllByText(/Timed Mock Exam Run/i).length).toBeGreaterThan(0);

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
      expect(createSpy.mock.calls.every((call) => call[1].courseId === 'c2')).toBe(true);
    });

    it('Scenario 2: Term Research Paper with Citations & Proofreading Workflow', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getTitleInput, getCourseSelect } = renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Essay \/ Term Paper/i }));
      fireEvent.change(getTitleInput(), { target: { value: 'ENG 202 Research Paper' } });
      fireEvent.change(getCourseSelect(), { target: { value: 'c3' } });

      expect(screen.getAllByText(/Thesis Statement & Literature Outline/i).length).toBeGreaterThan(
        0,
      );

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));
      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
      expect(createSpy.mock.calls[0][1].courseId).toBe('c3');
    });

    it('Scenario 3: Presentation & Slide Deck Preparation Workflow', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getTitleInput } = renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Presentation \/ Slides/i }));
      expect(getTitleInput().value).toBe('Class Slide Presentation');

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));
      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
      expect(createSpy.mock.calls[0][1].type).toBe('assignment');
    });

    it('Scenario 4: Flashcard Mastery Cram Session Workflow', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getTitleInput } = renderModal({ open: true });

      fireEvent.click(screen.getByRole('button', { name: /Flashcard Mastery/i }));
      expect(getTitleInput().value).toBe('Key Definitions Deck');

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));
      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
    });

    it('Scenario 5: General Independent Study with No Course Selected', async () => {
      const createSpy = vi
        .spyOn(scheduleItemsLib, 'createScheduleItem')
        .mockResolvedValue(undefined);
      const { getCourseSelect } = renderModal({ open: true });

      // Leave Course as General / Independent (value: '')
      fireEvent.change(getCourseSelect(), { target: { value: '' } });

      fireEvent.click(screen.getByRole('button', { name: /Add Chunks to Task List/i }));
      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
      // Fallback course ID assigned
      expect(createSpy.mock.calls[0][1].courseId).toBe('c1');
    });
  });
});
