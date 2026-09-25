import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyllabusExtractionReveal } from '../SyllabusExtractionReveal';

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('SyllabusExtractionReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders every fact', () => {
    mockMatchMedia(false);
    render(
      <SyllabusExtractionReveal
        facts={[
          'CS 301 · Data Structures',
          'Prof. Ada Lovelace',
          '3 assignments & deadlines found',
        ]}
        onDone={() => {}}
      />,
    );

    expect(screen.getByText('CS 301 · Data Structures')).toBeDefined();
    expect(screen.getByText('Prof. Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3 assignments & deadlines found')).toBeDefined();
  });

  it('calls onDone after the paced reveal finishes', () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    render(<SyllabusExtractionReveal facts={['CS 301 · Data Structures']} onDone={onDone} />);

    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips straight to onDone when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    render(
      <SyllabusExtractionReveal
        facts={['CS 301 · Data Structures', 'Prof. Ada Lovelace']}
        onDone={onDone}
      />,
    );

    vi.advanceTimersByTime(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
