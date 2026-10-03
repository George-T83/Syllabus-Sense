import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import {
  TEXT_SIZE_KEY,
  readPillHidden,
  readTextSize,
  writePillHidden,
  writeTextSize,
} from '@/lib/display/displayPrefs';
import { DisplaySettings } from '@/components/profile/DisplaySettings';
import { FloatingActionPill } from '@/components/ui/FloatingActionPill';
import { usePillHidden } from '@/hooks/useDisplayPrefs';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-text-size');
});
afterEach(cleanup);

describe('display preferences', () => {
  it('defaults to normal text and visible pills', () => {
    expect(readTextSize()).toBe('default');
    expect(readPillHidden('advisor')).toBe(false);
    expect(readPillHidden('focus')).toBe(false);
  });

  it('stores the text size and sets the attribute the stylesheet reads', () => {
    writeTextSize('larger');
    expect(window.localStorage.getItem(TEXT_SIZE_KEY)).toBe('larger');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('larger');
    expect(readTextSize()).toBe('larger');

    writeTextSize('default');
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
  });

  it('ignores an unrecognised stored text size', () => {
    window.localStorage.setItem(TEXT_SIZE_KEY, 'huge');
    expect(readTextSize()).toBe('default');
  });

  it('remembers each pill separately', () => {
    writePillHidden('focus', true);
    expect(readPillHidden('focus')).toBe(true);
    expect(readPillHidden('advisor')).toBe(false);
    writePillHidden('focus', false);
    expect(readPillHidden('focus')).toBe(false);
  });
});

describe('FloatingActionPill dismiss', () => {
  const base = {
    onClick: () => {},
    ariaLabel: 'Open thing',
    positionClassName: 'bottom-6 right-6',
    colorClassName: '',
    icon: null,
    label: 'Thing',
  };

  it('has no close button unless asked for one', () => {
    render(<FloatingActionPill {...base} />);
    expect(screen.queryByRole('button', { name: /Hide/ })).toBeNull();
  });

  it('keeps open and close as separate buttons', () => {
    const onClick = vi.fn();
    const onDismiss = vi.fn();
    render(
      <FloatingActionPill
        {...base}
        onClick={onClick}
        onDismiss={onDismiss}
        dismissLabel="Hide the thing"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide the thing' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open thing' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('usePillHidden', () => {
  function Probe() {
    const [hidden, setHidden] = usePillHidden('advisor');
    return <button onClick={() => setHidden(!hidden)}>{hidden ? 'hidden' : 'shown'}</button>;
  }

  it('updates every consumer when one changes it', () => {
    render(
      <>
        <Probe />
        <DisplaySettings />
      </>,
    );
    expect(screen.getByText('shown')).toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: 'Show the AI Advisor button' }));
    expect(screen.getByText('hidden')).toBeDefined();
    expect(readPillHidden('advisor')).toBe(true);
  });

  it('picks up a change made in another tab', () => {
    render(<Probe />);
    act(() => {
      window.localStorage.setItem('syllabus-sense-pill-hidden:advisor', 'true');
      window.dispatchEvent(new Event('storage'));
    });
    expect(screen.getByText('hidden')).toBeDefined();
  });
});

describe('DisplaySettings', () => {
  it('applies a text size and marks it pressed', () => {
    render(<DisplaySettings />);
    const large = screen.getByRole('button', { name: /^Large\s*112/ });
    expect(screen.getByRole('button', { name: /^Default/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(large);
    expect(large.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
  });

  it('turns each floating button on and off', () => {
    writePillHidden('focus', true);
    render(<DisplaySettings />);
    const focus = screen.getByRole('switch', { name: 'Show the Focus Timer button' });
    expect(focus.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(focus);
    expect(focus.getAttribute('aria-checked')).toBe('true');
    expect(readPillHidden('focus')).toBe(false);
  });
});
