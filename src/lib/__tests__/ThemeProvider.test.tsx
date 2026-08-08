import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '@/context/ThemeProvider';

// Helper component that consumes useTheme
function TestComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolvedTheme">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light
      </button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('system')} data-testid="set-system">
        Set System
      </button>
    </div>
  );
}

// Helper component that triggers hook outside provider to test error throwing
function FaultyComponent() {
  useTheme();
  return null;
}

describe('ThemeProvider', () => {
  let mockMatches = false;
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();

  beforeAll(() => {
    // Stub matchMedia since JSDOM does not implement it
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: mockMatches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockMatches = false;
    // Reset document element classes
    document.documentElement.className = '';
  });

  it('throws an error when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error in tests for this block
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<FaultyComponent />)).toThrow(
      'useTheme must be used within a ThemeProvider',
    );

    consoleSpy.mockRestore();
  });

  it('defaults to system theme and respects prefers-color-scheme', () => {
    mockMatches = true; // system prefers dark
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme').textContent).toBe('system');
    // After mount, resolvedTheme should reflect matchMedia query
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('adds and removes the dark class when themes are switched', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    // Default system (light query matches=false)
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Set to dark theme
    act(() => {
      screen.getByTestId('set-dark').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Set to light theme
    act(() => {
      screen.getByTestId('set-light').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists choices to localStorage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByTestId('set-dark').click();
    });
    expect(window.localStorage.getItem('syllabus-sense-theme')).toBe('dark');

    act(() => {
      screen.getByTestId('set-light').click();
    });
    expect(window.localStorage.getItem('syllabus-sense-theme')).toBe('light');
  });
});
