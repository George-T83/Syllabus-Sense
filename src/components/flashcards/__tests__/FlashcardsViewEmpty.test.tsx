import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlashcardsView } from '../FlashcardsView';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course } from '@/types/schedule';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/flashcards',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

function renderFlashcards(courses: Course[]) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ initialized: true, courses }}>
        <FlashcardsView />
      </AppStateProvider>
    </ToastProvider>,
  );
}

describe('FlashcardsView with no courses', () => {
  it('explains where flashcards come from and offers a way in', () => {
    renderFlashcards([]);
    expect(
      screen.getByRole('heading', { name: 'Flashcards come from your syllabus' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload a syllabus' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Add a course/ }).getAttribute('href')).toBe(
      '/courses',
    );
    expect(screen.getByText('Ready for exam day')).toBeTruthy();
  });

  it('shows the decks once there is a course', () => {
    renderFlashcards([{ id: 'cs', code: 'CSCI 213', title: 'Data Structures' }]);
    expect(
      screen.queryByRole('heading', { name: 'Flashcards come from your syllabus' }),
    ).toBeNull();
    expect(screen.getByText(/CSCI 213/)).toBeTruthy();
  });
});
