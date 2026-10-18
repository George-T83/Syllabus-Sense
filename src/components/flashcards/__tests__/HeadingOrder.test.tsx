import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlashcardDeckCard } from '../FlashcardDeckCard';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));
vi.mock('@/lib/firestore/useSyllabi', () => ({ useSyllabi: () => [] }));

describe('deck card headings', () => {
  it('sit one level under the page title (h2), not skipping to h3', () => {
    render(
      <ToastProvider>
        <AppStateProvider initialState={{ courses: [], scheduleItems: [] }}>
          <h1>Flashcards</h1>
          <FlashcardDeckCard
            course={{ id: 'bio', code: 'BIO 201', title: 'Cellular Biology' }}
            onReview={vi.fn()}
          />
        </AppStateProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'BIO 201' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
