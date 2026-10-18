import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizCard } from '../QuizCard';
import { AppStateProvider } from '@/context/AppStateContext';
import type { AppState } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Quiz } from '@/types/quiz';
import type { Course } from '@/types/schedule';
import type { SyllabusUpload } from '@/types/syllabus';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', getIdToken: vi.fn().mockResolvedValue('t') },
    loading: false,
  }),
}));

const syllabi: SyllabusUpload[] = [
  {
    id: 's1',
    courseId: 'c1',
    fileName: 's1.pdf',
    storagePath: 'users/user-1/s1.pdf',
    downloadURL: 'https://example.test/s1.pdf',
    sizeBytes: 1000,
    uploadedAt: '2026-08-01T00:00:00.000Z',
  },
];
vi.mock('@/lib/firestore/useSyllabi', () => ({ useSyllabi: () => syllabi }));

vi.mock('@/lib/firebase/client', () => ({ db: {} }));
const setDoc = vi.fn();
const deleteDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => args,
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
}));

const course: Course = { id: 'c1', code: 'CS 301', title: 'Algorithms', color: 'bg-blue-500' };
const oldQuiz: Quiz = {
  id: 'quiz-old',
  courseId: 'c1',
  createdAt: '2026-08-02T00:00:00.000Z',
  questions: [
    { question: 'Old Q', choices: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' },
    { question: 'Old Q2', choices: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' },
    { question: 'Old Q3', choices: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' },
  ],
};
const generated = [
  { question: 'New Q1', choices: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: 'x' },
  { question: 'New Q2', choices: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'y' },
];

function renderCard(state: Partial<AppState> = {}) {
  render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses: [course], ...state }}>
        <QuizCard course={course} onTake={vi.fn()} />
      </AppStateProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ questions: generated }), { status: 200 })),
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('regenerating a quiz', () => {
  it('saves the new quiz before removing the old one', async () => {
    const order: string[] = [];
    setDoc.mockImplementation(async () => void order.push('save'));
    deleteDoc.mockImplementation(async () => void order.push('delete'));
    renderCard({ quizzes: [oldQuiz] });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('2 questions')).toBeDefined();
    expect(order).toEqual(['save', 'delete']);
  });

  it('keeps the old quiz when the new one cannot be saved', async () => {
    setDoc.mockRejectedValue(new Error('offline'));
    renderCard({ quizzes: [oldQuiz] });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(await screen.findByText('3 questions')).toBeDefined();
  });

  it('ends with the old quiz, and only it, when removing the old one fails', async () => {
    deleteDoc.mockRejectedValueOnce(new Error('permission-denied')).mockResolvedValue(undefined);
    renderCard({ quizzes: [oldQuiz] });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('3 questions')).toBeDefined();
  });
});
