import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizCard } from '../QuizCard';
import { AppStateProvider } from '@/context/AppStateContext';
import type { AppState } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Quiz, QuizAttempt } from '@/types/quiz';
import type { Course } from '@/types/schedule';
import type { SyllabusUpload } from '@/types/syllabus';

const getIdToken = vi.fn().mockResolvedValue('id-token');
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', getIdToken }, loading: false }),
}));

let mockSyllabi: SyllabusUpload[] = [];
vi.mock('@/lib/firestore/useSyllabi', () => ({
  useSyllabi: () => mockSyllabi,
}));

// The real quizzes helpers run (optimistic dispatch + rollback); only the
// Firestore SDK underneath is replaced.
vi.mock('@/lib/firebase/client', () => ({ db: {} }));
const setDoc = vi.fn();
const deleteDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => args,
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
}));

const fetchMock = vi.fn();

const course: Course = { id: 'c1', code: 'CS 301', title: 'Algorithms', color: 'bg-blue-500' };

function syllabus(o: Partial<SyllabusUpload> & { id: string }): SyllabusUpload {
  return {
    courseId: 'c1',
    fileName: `${o.id}.pdf`,
    storagePath: `users/user-1/${o.id}.pdf`,
    downloadURL: 'https://example.test/file.pdf',
    sizeBytes: 1000,
    uploadedAt: '2026-08-01T00:00:00.000Z',
    ...o,
  };
}

function makeQuiz(id = 'quiz-old', questions = 3): Quiz {
  return {
    id,
    courseId: 'c1',
    createdAt: '2026-08-02T00:00:00.000Z',
    questions: Array.from({ length: questions }, (_, i) => ({
      question: `Q${i}`,
      choices: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
      explanation: 'because',
    })),
  };
}

function attempt(o: Partial<QuizAttempt> & { id: string }): QuizAttempt {
  return {
    quizId: 'quiz-old',
    courseId: 'c1',
    score: 1,
    total: 3,
    completedAt: '2026-08-03T00:00:00.000Z',
    ...o,
  };
}

const generatedQuestions = [
  { question: 'New Q1', choices: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: 'x' },
  { question: 'New Q2', choices: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'y' },
];

function renderCard(state: Partial<AppState> = {}, onTake = vi.fn()) {
  render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses: [course], ...state }}>
        <QuizCard course={course} onTake={onTake} />
      </AppStateProvider>
    </ToastProvider>,
  );
  return onTake;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSyllabi = [];
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('QuizCard without a syllabus', () => {
  it('tells the student to upload a syllabus and offers no actions', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'CS 301' })).toBeDefined();
    expect(screen.getByText(/Upload a syllabus on this course's page/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('QuizCard with a syllabus but no quiz', () => {
  beforeEach(() => {
    mockSyllabi = [syllabus({ id: 's1' })];
  });

  it('offers Generate Quiz and no Take or Delete', () => {
    renderCard();
    expect(screen.getByText('No quiz yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Generate Quiz' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Take Quiz' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete quiz' })).toBeNull();
  });

  it('says the questions are AI-written and links to the syllabus check', () => {
    renderCard();
    expect(screen.getByText(/Questions are written by AI from your syllabus/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Check the syllabus' })).toBeDefined();
  });

  it('generates from the newest syllabus, shows progress, then the new quiz', async () => {
    mockSyllabi = [
      syllabus({ id: 'old', uploadedAt: '2026-07-01T00:00:00.000Z' }),
      syllabus({ id: 'new', uploadedAt: '2026-09-01T00:00:00.000Z' }),
    ];
    let resolveFetch!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolveFetch = r)));
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Quiz' }));
    const busy = (await screen.findByRole('button', {
      name: 'Generating…',
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/syllabus/quiz');
    expect(init.headers.Authorization).toBe('Bearer id-token');
    expect(JSON.parse(init.body)).toEqual({
      storagePath: 'users/user-1/new.pdf',
      fileName: 'new.pdf',
    });

    resolveFetch(new Response(JSON.stringify({ questions: generatedQuestions }), { status: 200 }));
    expect(await screen.findByText('2 questions')).toBeDefined();
    expect(screen.getByText('Quiz generated')).toBeDefined();
    expect(screen.getByText('2 questions ready for CS 301.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Take Quiz' })).toBeDefined();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('shows rate-limit copy inline and keeps Generate available to retry', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'limit' }), { status: 429 }));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Quiz' }));
    expect(
      await screen.findByText(
        "You've used today's AI requests. They reset tomorrow, so try again then.",
      ),
    ).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Generate Quiz' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('shows the offline copy when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Quiz' }));
    expect(
      await screen.findByText("Couldn't reach the server. Check your connection and try again."),
    ).toBeDefined();
  });

  it('rejects a malformed AI response instead of saving a broken quiz', async () => {
    const broken = [
      { question: 'Only two choices', choices: ['a', 'b'], correctIndex: 0, explanation: 'x' },
    ];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ questions: broken }), { status: 200 }),
    );
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Quiz' }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeDefined();
    expect(setDoc).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Take Quiz' })).toBeNull();
  });

  it('clears an earlier error when the student tries again', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Quiz' }));
    await screen.findByText('Something went wrong on our side. Try again in a moment.');

    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Quiz' }));
    await screen.findByRole('button', { name: 'Generating…' });
    expect(screen.queryByText(/Something went wrong on our side/)).toBeNull();
  });
});

describe('QuizCard with a quiz', () => {
  beforeEach(() => {
    mockSyllabi = [syllabus({ id: 's1' })];
  });

  it('shows the question count and hands the quiz to onTake', () => {
    const quiz = makeQuiz();
    const onTake = renderCard({ quizzes: [quiz] });
    expect(screen.getByText('3 questions')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Take Quiz' }));
    expect(onTake).toHaveBeenCalledWith(quiz);
  });

  it('labels the generate button Regenerate once a quiz exists', () => {
    renderCard({ quizzes: [makeQuiz()] });
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Generate Quiz' })).toBeNull();
  });

  it('shows best and latest score with a pluralised attempt count', () => {
    renderCard({
      quizzes: [makeQuiz()],
      quizAttempts: [
        attempt({ id: 'a1', score: 2, total: 3, completedAt: '2026-08-03T00:00:00.000Z' }),
        attempt({ id: 'a2', score: 3, total: 3, completedAt: '2026-08-04T00:00:00.000Z' }),
        attempt({ id: 'a3', score: 1, total: 3, completedAt: '2026-08-05T00:00:00.000Z' }),
      ],
    });
    expect(screen.getByText('Best: 3/3')).toBeDefined();
    expect(screen.getByText(/Last attempt: 1\/3/)).toBeDefined();
    expect(screen.getByText(/3 attempts total/)).toBeDefined();
  });

  it('uses the singular for one attempt', () => {
    renderCard({ quizzes: [makeQuiz()], quizAttempts: [attempt({ id: 'a1' })] });
    expect(screen.getByText(/1 attempt total/)).toBeDefined();
  });

  it('ranks best by percentage, not raw points, and ignores other courses', () => {
    renderCard({
      quizzes: [makeQuiz()],
      quizAttempts: [
        attempt({ id: 'a1', score: 4, total: 10 }),
        attempt({ id: 'a2', score: 3, total: 4 }),
        attempt({ id: 'other', courseId: 'c2', score: 10, total: 10 }),
      ],
    });
    expect(screen.getByText('Best: 3/4')).toBeDefined();
    expect(screen.getByText(/2 attempts total/)).toBeDefined();
  });

  it('shows no score line before any attempt', () => {
    renderCard({ quizzes: [makeQuiz()] });
    expect(screen.queryByText(/Best:/)).toBeNull();
    expect(screen.queryByText(/Last attempt/)).toBeNull();
  });

  it('replaces the old quiz when regenerated', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ questions: generatedQuestions }), { status: 200 }),
    );
    renderCard({ quizzes: [makeQuiz()] });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('2 questions')).toBeDefined();
    expect(screen.queryByText('3 questions')).toBeNull();
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before deleting and lets the student cancel', () => {
    renderCard({ quizzes: [makeQuiz()] });
    fireEvent.click(screen.getByRole('button', { name: 'Delete quiz' }));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete quiz' })).toBeDefined();
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(screen.getByText('3 questions')).toBeDefined();
  });

  it('deletes the quiz on confirm and says so', async () => {
    renderCard({ quizzes: [makeQuiz()] });
    fireEvent.click(screen.getByRole('button', { name: 'Delete quiz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Quiz deleted')).toBeDefined();
    expect(screen.getByText('The quiz for CS 301 was removed.')).toBeDefined();
    expect(screen.getByText('No quiz yet')).toBeDefined();
  });

  it('keeps the quiz and reports an error when the delete fails', async () => {
    deleteDoc.mockRejectedValue(new Error('permission-denied'));
    renderCard({ quizzes: [makeQuiz()] });
    fireEvent.click(screen.getByRole('button', { name: 'Delete quiz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Could not delete this quiz')).toBeDefined();
    expect(screen.getByText('permission-denied')).toBeDefined();
    await waitFor(() => expect(screen.getByText('3 questions')).toBeDefined());
  });
});

describe('QuizCard with a quiz but its syllabus removed', () => {
  it('still lets the student take the quiz but not regenerate it', () => {
    mockSyllabi = [];
    renderCard({ quizzes: [makeQuiz()] });
    expect(screen.getByRole('button', { name: 'Take Quiz' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check the syllabus' })).toBeNull();
  });
});
