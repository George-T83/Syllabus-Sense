import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => {
  /** Like Firebase's User: the methods are on the prototype, so copying the
   * object with a spread loses them. */
  class FakeUser {
    uid = 'u1';
    email = 'a@b.test';
    displayName: string | null = 'Old Name';
    getIdToken() {
      return Promise.resolve('real-token');
    }
  }
  return {
    FakeUser,
    state: {
      listener: null as null | ((u: unknown) => void),
      authMock: { currentUser: null as unknown },
    },
  };
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    h.state.listener = cb;
    return () => {};
  },
  updateProfile: vi.fn(async (user: { displayName: string | null }, p: { displayName: string }) => {
    user.displayName = p.displayName; // the real SDK updates the same object
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: vi.fn(),
  updatePassword: vi.fn(),
  deleteUser: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
}));
vi.mock('@/lib/firebase/client', () => ({ auth: h.state.authMock }));

import { AuthProvider, useAuth } from '../AuthContext';

let latest: ReturnType<typeof useAuth>;
function Probe() {
  latest = useAuth();
  return <div data-testid="name">{latest.user?.displayName ?? 'none'}</div>;
}

describe('AuthProvider.updateDisplayName', () => {
  beforeEach(() => {
    h.state.authMock.currentUser = null;
    h.state.listener = null;
  });

  async function signedIn() {
    const user = new h.FakeUser();
    h.state.authMock.currentUser = user;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => h.state.listener?.(user));
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Old Name'));
    return user;
  }

  it('shows the new name straight away', async () => {
    await signedIn();
    await act(async () => {
      await latest.updateDisplayName('New Name');
    });
    expect(screen.getByTestId('name').textContent).toBe('New Name');
  });

  it('keeps the real Firebase user, so getIdToken still works afterwards', async () => {
    const user = await signedIn();
    await act(async () => {
      await latest.updateDisplayName('New Name');
    });
    expect(latest.user).toBe(user);
    expect(typeof latest.user?.getIdToken).toBe('function');
    await expect(latest.user!.getIdToken()).resolves.toBe('real-token');
  });
});
