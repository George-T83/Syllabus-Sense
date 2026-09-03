import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-auth-domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project-id';
});

const {
  mockCurrentUser,
  updatePasswordMock,
  deleteUserMock,
  reauthenticateWithCredentialMock,
  credentialMock,
  sendPasswordResetEmailMock,
} = vi.hoisted(() => ({
  mockCurrentUser: {
    uid: 'u1',
    email: 'student@campus.edu',
    displayName: 'Student One',
    providerData: [{ providerId: 'password' }],
  },
  updatePasswordMock: vi.fn(),
  deleteUserMock: vi.fn(),
  reauthenticateWithCredentialMock: vi.fn(),
  credentialMock: vi.fn((email: string, password: string) => ({ email, password })),
  sendPasswordResetEmailMock: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: mockCurrentUser })),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mockCurrentUser);
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  updatePassword: (...args: unknown[]) => updatePasswordMock(...args),
  deleteUser: (...args: unknown[]) => deleteUserMock(...args),
  reauthenticateWithCredential: (...args: unknown[]) => reauthenticateWithCredentialMock(...args),
  EmailAuthProvider: {
    credential: (...args: [string, string]) => credentialMock(...args),
  },
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

function TestConsumer() {
  const { error, changePassword, deleteAccount, resetPassword } = useAuth();
  return (
    <div>
      <span data-testid="auth-error">{error ?? 'none'}</span>
      <button data-testid="reset-password-btn" onClick={() => resetPassword('test@student.edu')}>
        Reset password
      </button>
      <button
        data-testid="change-password-btn"
        onClick={() => changePassword('oldpass123', 'newpass456')}
      >
        Change password
      </button>
      <button data-testid="delete-account-btn" onClick={() => deleteAccount('oldpass123')}>
        Delete account
      </button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

describe('AuthContext - changePassword', () => {
  beforeEach(() => {
    updatePasswordMock.mockReset();
    reauthenticateWithCredentialMock.mockReset();
    credentialMock.mockClear();
  });

  it('re-authenticates with the current password before calling updatePassword', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    updatePasswordMock.mockResolvedValue(undefined);
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('change-password-btn'));
    });

    expect(credentialMock).toHaveBeenCalledWith('student@campus.edu', 'oldpass123');
    expect(reauthenticateWithCredentialMock).toHaveBeenCalled();
    expect(updatePasswordMock).toHaveBeenCalledWith(mockCurrentUser, 'newpass456');
    expect(screen.getByTestId('auth-error').textContent).toBe('none');
  });

  it('surfaces a friendly message when Firebase requires a fresh login', async () => {
    reauthenticateWithCredentialMock.mockRejectedValue({ code: 'auth/requires-recent-login' });
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('change-password-btn'));
    });

    expect(updatePasswordMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-error').textContent).toMatch(/sign in again/i);
  });
});

describe('AuthContext - deleteAccount', () => {
  beforeEach(() => {
    deleteUserMock.mockReset();
    reauthenticateWithCredentialMock.mockReset();
    credentialMock.mockClear();
  });

  it('re-authenticates then calls deleteUser when a password is supplied', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    deleteUserMock.mockResolvedValue(undefined);
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-account-btn'));
    });

    expect(credentialMock).toHaveBeenCalledWith('student@campus.edu', 'oldpass123');
    expect(reauthenticateWithCredentialMock).toHaveBeenCalled();
    expect(deleteUserMock).toHaveBeenCalledWith(mockCurrentUser);
  });

  it('maps a wrong password rejection to a friendly error and never calls deleteUser', async () => {
    reauthenticateWithCredentialMock.mockRejectedValue({ code: 'auth/wrong-password' });
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-account-btn'));
    });

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-error').textContent).toMatch(/incorrect email or password/i);
  });
});

describe('AuthContext - resetPassword', () => {
  beforeEach(() => {
    sendPasswordResetEmailMock.mockReset();
  });

  it('calls sendPasswordResetEmail with target email and clears error on success', async () => {
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-password-btn'));
    });

    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(expect.anything(), 'test@student.edu');
    expect(screen.getByTestId('auth-error').textContent).toBe('none');
  });

  it('surfaces friendly error message when reset email fails', async () => {
    sendPasswordResetEmailMock.mockRejectedValue({ code: 'auth/user-not-found' });
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-password-btn'));
    });

    expect(screen.getByTestId('auth-error').textContent).toMatch(/incorrect email or password/i);
  });
});
