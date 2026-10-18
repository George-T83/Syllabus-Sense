import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthGuard from '../AuthGuard';

let mockAuth: { user: { uid: string } | null; loading: boolean };
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

function renderGuard() {
  return render(
    <AuthGuard>
      <p>Private dashboard</p>
    </AuthGuard>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthGuard', () => {
  it('shows the app to a signed-in student without redirecting', () => {
    mockAuth = { user: { uid: 'u1' }, loading: false };
    renderGuard();
    expect(screen.getByText('Private dashboard')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the page hidden and waits while auth state is resolving', () => {
    mockAuth = { user: null, loading: true };
    renderGuard();
    expect(screen.queryByText('Private dashboard')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect a returning student before auth finishes loading', () => {
    // A signed-in student on a hard refresh starts as user=null, loading=true.
    mockAuth = { user: null, loading: true };
    const { rerender } = renderGuard();
    mockAuth = { user: { uid: 'u1' }, loading: false };
    rerender(
      <AuthGuard>
        <p>Private dashboard</p>
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('Private dashboard')).toBeDefined();
  });

  it('sends a signed-out visitor to the login page and never renders the content', () => {
    mockAuth = { user: null, loading: false };
    renderGuard();
    expect(replace).toHaveBeenCalledWith('/login');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Private dashboard')).toBeNull();
  });

  it('redirects with replace so Back does not return to the protected page', () => {
    mockAuth = { user: null, loading: false };
    renderGuard();
    // The mocked router exposes only `replace`; a `push` call would throw.
    expect(replace).toHaveBeenCalled();
  });

  it('redirects if the student signs out while on the page', () => {
    mockAuth = { user: { uid: 'u1' }, loading: false };
    const { rerender } = renderGuard();
    expect(replace).not.toHaveBeenCalled();
    mockAuth = { user: null, loading: false };
    rerender(
      <AuthGuard>
        <p>Private dashboard</p>
      </AuthGuard>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Private dashboard')).toBeNull();
  });
});
