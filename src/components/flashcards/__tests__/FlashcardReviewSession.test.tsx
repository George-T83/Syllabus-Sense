import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlashcardReviewSession } from '../FlashcardReviewSession';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';
import { toDayKey, addDays } from '@/lib/calendar/dates';

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    courseId: 'bio',
    front: 'What is the powerhouse of the cell?',
    back: 'The mitochondria',
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    dueDate: toDayKey(new Date()),
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const courses: Course[] = [{ id: 'bio', code: 'BIO 201', title: 'Cellular Biology' }];

function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

/** A real tap fires pointerdown then pointerup at (roughly) the same spot -
 * fireEvent.click doesn't synthesize those, so it never reaches the
 * component's pointer-driven flip/swipe handling. */
function tap(element: HTMLElement) {
  fireEvent.pointerDown(element, { clientX: 0 });
  fireEvent.pointerUp(element, { clientX: 0 });
}

function drag(element: HTMLElement, dx: number) {
  fireEvent.pointerDown(element, { clientX: 0 });
  fireEvent.pointerMove(element, { clientX: dx });
  fireEvent.pointerUp(element, { clientX: dx });
}

const question = () => screen.getByRole('button', { name: /showing question/i });
const answer = () => screen.getByRole('button', { name: /showing answer/i });

function renderSession(props: Partial<React.ComponentProps<typeof FlashcardReviewSession>> = {}) {
  return render(
    <FlashcardReviewSession
      cards={[makeCard()]}
      courses={courses}
      onClose={vi.fn()}
      onRate={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );
}

describe('FlashcardReviewSession', () => {
  beforeEach(() => {
    mockReducedMotion(true);
    // jsdom has no canvas; the study-space backdrop bails out cleanly.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  });

  it('renders nothing when cards is null', () => {
    const { container } = renderSession({ cards: null });
    expect(container.firstChild).toBeNull();
  });

  it('shows the question, the course, and a gut-call prompt before the flip', () => {
    renderSession();
    expect(screen.getByText('Card 1 of 1')).toBeDefined();
    expect(screen.getAllByText('What is the powerhouse of the cell?').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BIO 201').length).toBeGreaterThan(0);
    expect(screen.getByText('Gut call before you flip — do you know it?')).toBeDefined();
    expect(screen.getByText('Know it')).toBeDefined();
    expect(screen.queryByText('Again')).toBeNull();
    expect(screen.getByText('New card · first look')).toBeDefined();
  });

  it('frames the session around the next exam and shows readiness', () => {
    const exam: ScheduleItem = {
      id: 'm',
      courseId: 'bio',
      title: 'Midterm',
      type: 'exam',
      dueDate: toDayKey(addDays(new Date(), 9)),
      completed: false,
      gradeWeight: 25,
    };
    renderSession({ scheduleItems: [exam] });
    expect(screen.getByText('Midterm · 25% · in 9 days')).toBeDefined();
    expect(screen.getByRole('progressbar', { name: /Exam readiness/ })).toBeDefined();
  });

  it('reveals the answer and rating buttons on tap', () => {
    renderSession();
    tap(question());
    expect(screen.getByText('The mitochondria')).toBeDefined();
    expect(screen.getByText('Again')).toBeDefined();
    expect(screen.getByText('Good')).toBeDefined();
  });

  it('flips when a gut call is made and rewards a correct Know-it call', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    const cards = [makeCard({ id: 'a', front: 'Q1' }), makeCard({ id: 'b', front: 'Q2' })];
    renderSession({ cards, onRate });

    fireEvent.click(screen.getByText('Know it'));
    expect(screen.getByText('Again')).toBeDefined();
    fireEvent.click(screen.getByText('Good'));

    expect(onRate).toHaveBeenCalledWith(cards[0], 'good');
    await waitFor(() => expect(screen.getByText('Card 2 of 2')).toBeDefined());
    expect(screen.getByText('Called it')).toBeDefined();
    expect(screen.getByText(/\+25 pts/)).toBeDefined();
  });

  it('supports the keyboard: number keys for the gut call and the rating', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    renderSession({ onRate, cards: [makeCard({ id: 'a' }), makeCard({ id: 'b' })] });
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByText('Again')).toBeDefined();
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => expect(onRate).toHaveBeenCalledWith(expect.anything(), 'again'));
    expect(await screen.findByText('Honest call — that’s how it sticks')).toBeDefined();
  });

  it('flips with Space and rates Good with the right arrow', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    renderSession({ onRate });
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText('Again')).toBeDefined();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(onRate).toHaveBeenCalledWith(expect.anything(), 'good'));
  });

  it('shows the recap when the session is complete and calls onClose from Done', async () => {
    const onClose = vi.fn();
    renderSession({ onClose });
    tap(question());
    fireEvent.click(screen.getByText('Easy'));

    await waitFor(() => expect(screen.getByText('Session complete')).toBeDefined());
    expect(screen.getByText('Recalled')).toBeDefined();
    expect(screen.getByText('Best combo')).toBeDefined();
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the card on screen when onRate rejects, instead of advancing', async () => {
    const onRate = vi.fn().mockRejectedValue(new Error('save failed'));
    const cards = [makeCard({ id: 'a', front: 'Q1' }), makeCard({ id: 'b', front: 'Q2' })];
    renderSession({ cards, onRate });

    tap(question());
    fireEvent.click(screen.getByText('Again'));

    await waitFor(() => expect(onRate).toHaveBeenCalled());
    expect(screen.getByText('Card 1 of 2')).toBeDefined();
    expect(screen.getAllByText('Q1').length).toBeGreaterThan(0);
  });

  it('rates Good when dragged past the swipe threshold to the right', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b' })];
    renderSession({ cards, onRate });

    tap(question());
    drag(answer(), 160);

    await waitFor(() => expect(onRate).toHaveBeenCalledWith(cards[0], 'good'));
  });

  it('rates Again when dragged past the swipe threshold to the left', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    renderSession({ onRate });

    tap(question());
    drag(answer(), -160);

    await waitFor(() => expect(onRate).toHaveBeenCalledWith(expect.anything(), 'again'));
  });

  it('springs back without rating on a small drag below the swipe threshold', () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    renderSession({ onRate });

    tap(question());
    drag(answer(), 30);

    expect(onRate).not.toHaveBeenCalled();
    expect(screen.getByText('Again')).toBeDefined();
  });

  it('does not drag before the card is revealed - a pre-reveal drag reads as a tap', () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    renderSession({ onRate });

    drag(question(), 160);

    expect(onRate).not.toHaveBeenCalled();
    expect(screen.getByText('Again')).toBeDefined();
  });

  it('builds a combo across consecutive recalls', async () => {
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b' }), makeCard({ id: 'c' })];
    renderSession({ cards });

    for (const expected of ['Card 2 of 3', 'Card 3 of 3']) {
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: '3' });
      await waitFor(() => expect(screen.getByText(expected)).toBeDefined());
    }
    expect(screen.getByText('×2')).toBeDefined();
  });
});
