import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryTiles } from '../MemoryTiles';
import type { Flashcard } from '@/types/flashcard';

const TODAY = new Date(2026, 8, 26, 9, 0);

function card(id: string, front: string, overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id,
    courseId: 'bio',
    front,
    back: 'answer',
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    dueDate: '2026-09-26',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const lockedIn = card('a', 'Locked question', {
  interval: 30,
  repetitions: 4,
  dueDate: '2026-10-20',
  lastReviewedAt: '2026-09-24T12:00:00',
});
const slipping = card('b', 'Slipping question', {
  interval: 1,
  repetitions: 0,
  dueDate: '2026-09-21',
  lastReviewedAt: '2026-09-20T12:00:00',
});
const learning = card('c', 'Learning question', {
  interval: 6,
  repetitions: 2,
  dueDate: '2026-09-29',
  lastReviewedAt: '2026-09-23T12:00:00',
});
const notStarted = card('d', 'New question');

describe('MemoryTiles', () => {
  it('leads with what to do when cards are slipping, naming the exam', () => {
    render(<MemoryTiles cards={[lockedIn, slipping]} examTitle="Midterm" today={TODAY} />);
    expect(screen.getByText('1 card is slipping — review it before the Midterm.')).toBeDefined();
  });

  it('falls back to not-started, then learning, then all-locked-in headlines', () => {
    const { rerender } = render(
      <MemoryTiles cards={[lockedIn, notStarted]} examTitle={null} today={TODAY} />,
    );
    expect(screen.getByText('1 card hasn’t been studied yet.')).toBeDefined();
    rerender(<MemoryTiles cards={[lockedIn, learning]} examTitle={null} today={TODAY} />);
    expect(
      screen.getByText('Nothing slipping — keep up with reviews to lock the rest in.'),
    ).toBeDefined();
    rerender(<MemoryTiles cards={[lockedIn]} examTitle={null} today={TODAY} />);
    expect(screen.getByText('Every card is locked in.')).toBeDefined();
  });

  it('orders tiles so slipping cards come first and labels them in plain words', () => {
    render(
      <MemoryTiles
        cards={[notStarted, lockedIn, learning, slipping]}
        examTitle="Midterm"
        today={TODAY}
      />,
    );
    const tiles = within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Slipping question — Slipping · review today',
      'Learning question — Learning · next review Sep 29',
      'Locked question — Locked in · next review Oct 20',
      'New question — Not started yet',
    ]);
  });

  it('shows the counts per state', () => {
    render(
      <MemoryTiles cards={[lockedIn, learning, slipping]} examTitle="Midterm" today={TODAY} />,
    );
    const legend = screen.getAllByRole('list')[1];
    expect(legend.textContent).toContain('1Slipping');
    expect(legend.textContent).toContain('1Locked in');
    expect(legend.textContent).toContain('0Not started');
  });

  it('shows a card on hover and on arrow-key focus', () => {
    render(<MemoryTiles cards={[lockedIn, slipping]} examTitle="Midterm" today={TODAY} />);
    const list = screen.getAllByRole('list')[0];
    fireEvent.pointerEnter(within(list).getAllByRole('listitem')[1]);
    expect(screen.getByText('Locked question')).toBeDefined();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(screen.getByText('Slipping question')).toBeDefined();
  });
});
