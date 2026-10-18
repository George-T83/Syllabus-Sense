import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizzesView } from '../QuizzesView';
import { AppStateProvider } from '@/context/AppStateContext';
import type { AppState } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Quiz } from '@/types/quiz';
import type { Course } from '@/types/schedule';
import type { SyllabusUpload } from '@/types/syllabus';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', getIdToken: () => Promise.resolve('t') },
    loading: false,
  }),
}));

let mockSyllabi: SyllabusUpload[] = [];
vi.mock('@/lib/firestore/useSyllabi', () => ({
  useSyllabi: () => mockSyllabi,
}));

vi.mock('@/lib/firebase/client', () => ({ db: {} }));
const setDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => args,
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: vi.fn(),
}));

const courses: Course[] = [
  { id: 'c1', code: 'CS 301', title: 'Algorithms', color: 'bg-blue-500' },
  { id: 'c2', code: 'MATH 240', title: 'Linear Algebra', color: 'bg-green-500' },
];

const quiz: Quiz = {
  id: 'quiz-1',
  courseId: 'c1',
  createdAt: '2026-08-01T00:00:00.000Z',
  questions: [
    { question: 'Pick a', choices: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'it is a' },
  ],
};

function renderView(state: Partial<AppState> = {}) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses, ...state }}>
        <QuizzesView />
      </AppStateProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSyllabi = [];
  setDoc.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuizzesView', () => {
  it('shows an empty state with no courses', () => {
    renderView({ courses: [] });
    expect(screen.getByRole('heading', { name: 'Practice Quizzes' })).toBeDefined();
    expect(screen.getByText('No courses yet')).toBeDefined();
    expect(screen.getByText(/Add a course and upload its syllabus/)).toBeDefined();
  });

  it('shows one card per course', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'CS 301' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'MATH 240' })).toBeDefined();
  });

  it('opens the quiz session when Take Quiz is pressed and closes it again', () => {
    mockSyllabi = [
      {
        id: 's1',
        courseId: 'c1',
        fileName: 's.pdf',
        storagePath: 'p',
        downloadURL: 'u',
        sizeBytes: 1,
        uploadedAt: '2026-08-01T00:00:00.000Z',
      },
    ];
    renderView({ quizzes: [quiz] });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Take Quiz' }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Pick a')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close quiz' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('records the attempt and shows it on the course card after finishing', async () => {
    renderView({ quizzes: [quiz] });
    fireEvent.click(screen.getByRole('button', { name: 'Take Quiz' }));
    fireEvent.click(screen.getByRole('button', { name: 'a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Score saved to this course.')).toBeDefined();
    expect(setDoc).toHaveBeenCalledTimes(1);
    const saved = setDoc.mock.calls[0][1];
    expect(saved).toMatchObject({ quizId: 'quiz-1', courseId: 'c1', score: 1, total: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Best: 1/1')).toBeDefined();
  });

  it('warns the student when the score cannot be saved', async () => {
    setDoc.mockRejectedValue(new Error('network down'));
    renderView({ quizzes: [quiz] });
    fireEvent.click(screen.getByRole('button', { name: 'Take Quiz' }));
    fireEvent.click(screen.getByRole('button', { name: 'b' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Could not save your score')).toBeDefined();
    expect(
      screen.getByText("Couldn't save your score. Your result isn't recorded for this course."),
    ).toBeDefined();
    // The optimistic attempt is rolled back so the card does not claim a score.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText(/Best:/)).toBeNull());
  });
});
