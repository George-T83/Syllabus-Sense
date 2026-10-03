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
  reauthenticateWithPopup: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
}));
vi.mock('@/lib/firebase/client', () => ({ auth: h.state.authMock }));

import { deleteUser, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';
import { AuthProvider, useAuth } from '../AuthContext';
import { loadSessions, saveSession } from '@/lib/focus/pomodoroSessions';

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

describe('AuthProvider.deleteAccount', () => {
  const getIdToken = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getIdToken.mockResolvedValue('fresh-token');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    h.state.listener = null;
  });

  async function signedInWith(providerIds: string[]) {
    const user = Object.assign(new h.FakeUser(), {
      providerData: providerIds.map((providerId) => ({ providerId })),
      getIdToken,
    });
    h.state.authMock.currentUser = user;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => h.state.listener?.(user));
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Old Name'));
  }

  it('re-authenticates a password account, refreshes the token, then deletes data and login', async () => {
    await signedInWith(['password']);
    saveSession('u1', { startedAt: '2026-10-01T10:00:00Z', duration: 1500 });

    let ok = false;
    await act(async () => {
      ok = await latest.deleteAccount('hunter2');
    });

    expect(ok).toBe(true);
    expect(reauthenticateWithCredential).toHaveBeenCalled();
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/delete',
      expect.objectContaining({ headers: { Authorization: 'Bearer fresh-token' } }),
    );
    expect(deleteUser).toHaveBeenCalled();
    expect(loadSessions('u1')).toEqual([]);
  });

  it('re-authenticates a Google account through the Google popup before deleting anything', async () => {
    await signedInWith(['google.com']);

    await act(async () => {
      await latest.deleteAccount();
    });

    expect(reauthenticateWithPopup).toHaveBeenCalled();
    const popupOrder = vi.mocked(reauthenticateWithPopup).mock.invocationCallOrder[0];
    expect(popupOrder).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(deleteUser).toHaveBeenCalled();
  });

  it('keeps the account and shows the reason when the server wants a newer sign-in', async () => {
    await signedInWith(['password']);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'For your security, please sign in again before deleting your account.',
        code: 'recent-login-required',
      }),
    });

    let ok = true;
    await act(async () => {
      ok = await latest.deleteAccount('hunter2');
    });

    expect(ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(latest.error).toMatch(/sign in again/i);
  });

  it('keeps the account and says why when uploaded files could not be deleted', async () => {
    await signedInWith(['password']);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Your data was removed, but some uploaded files couldn't be deleted.",
      }),
    });

    let ok = true;
    await act(async () => {
      ok = await latest.deleteAccount('hunter2');
    });

    expect(ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(latest.error).toMatch(/uploaded files/i);
  });
});
