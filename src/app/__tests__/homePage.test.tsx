import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../page';

let mockAuth: { user: { uid: string } | null; loading: boolean };
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/context/ThemeProvider', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Home (root route)', () => {
  it('shows the landing page to a signed-out visitor instead of bouncing to login', () => {
    mockAuth = { user: null, loading: false };
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Get started free' })).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows neither the pitch nor a redirect while auth is loading', () => {
    mockAuth = { user: null, loading: true };
    render(<Home />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a signed-in student to the dashboard without flashing the landing page', () => {
    mockAuth = { user: { uid: 'u1' }, loading: false };
    render(<Home />);
    expect(replace).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Get started free' })).toBeNull();
  });
});
