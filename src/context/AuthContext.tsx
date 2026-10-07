'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { clearSessions } from '@/lib/focus/pomodoroSessions';
import { clearOfflineData } from '@/lib/offline/clearOfflineData';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<boolean>;
  updateDisplayName: (displayName: string) => Promise<boolean>;
  /**
   * Changes the signed-in user's password. Firebase treats this as a
   * "sensitive" operation that requires a recently-issued ID token, so this
   * re-authenticates with the current password via
   * `EmailAuthProvider`/`reauthenticateWithCredential` immediately before
   * calling `updatePassword` - without it, an account that signed in more
   * than a few minutes ago gets `auth/requires-recent-login` instead of the
   * password actually changing. Only meaningful for email/password
   * accounts (`user.providerData` includes the `password` provider); the
   * caller is expected to hide this control for Google-only accounts,
   * which have no password here to change.
   */
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  /**
   * Deletes all of the signed-in user's data (every course, task, mood
   * entry, uploaded syllabus file - everything under `users/{uid}`) via
   * `/api/account/delete`, then deletes the Firebase Auth account itself via
   * `deleteUser`. Also a "sensitive" operation subject to the same
   * recent-login requirement as `changePassword` - `currentPassword` is
   * required for email/password accounts (re-authenticated the same way)
   * and Google accounts are re-authenticated through the Google popup, so
   * the sign-in is always fresh before anything is deleted (the server
   * refuses an older one rather than wiping the data and then failing to
   * delete the login). Data deletion runs before the Auth account: if it
   * fails, the Auth account is left untouched so the user isn't locked out
   * mid-deletion with orphaned data either way.
   */
  deleteAccount: (currentPassword?: string) => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Minimal friendly-message mapping. Full mapping/toast wiring is issue #24.
function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again before doing this.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // updateProfile changes the signed-in User object in place, so `user` keeps
  // the same reference and React would not re-render. Bumping this counter is
  // what makes consumers pick up the new displayName.
  const [, setProfileRevision] = useState(0);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      (window.localStorage.getItem('mock_auth') === 'true' ||
        window.location.search.includes('mock=true'))
    ) {
      if (window.location.search.includes('mock=true')) {
        window.localStorage.setItem('mock_auth', 'true');
      }
      setUser({
        uid: 'kyHjDg6iM5YokWhHTh071SW6Yds2',
        email: 'dev-test@syllabussense.dev',
        displayName: 'Dev Test Student',
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'mock-token',
        getIdTokenResult: async () => ({}) as unknown as Record<string, unknown>,
        reload: async () => {},
        toJSON: () => ({}),
        phoneNumber: null,
        photoURL: null,
        providerId: 'firebase',
      } as unknown as User);
      setLoading(false);
      return;
    }

    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (
        process.env.NODE_ENV !== 'production' &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem('mock_auth') === 'true'
      ) {
        return;
      }
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAuthAction = async (action: () => Promise<unknown>): Promise<boolean> => {
    if (!auth) {
      setError('Authentication is not configured.');
      return false;
    }
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(mapAuthError(err));
      return false;
    }
  };

  const signIn = (email: string, password: string) =>
    runAuthAction(() => signInWithEmailAndPassword(auth!, email, password));

  const signUp = (email: string, password: string) =>
    runAuthAction(() => createUserWithEmailAndPassword(auth!, email, password));

  const resetPassword = (email: string) =>
    runAuthAction(() => sendPasswordResetEmail(auth!, email));

  const signInWithGoogle = () =>
    runAuthAction(() => signInWithPopup(auth!, new GoogleAuthProvider()));

  const signOut = () =>
    runAuthAction(async () => {
      await firebaseSignOut(auth!);
      // The student's data stays on this device for offline use; leaving removes it.
      await clearOfflineData();
    });

  const updateDisplayName = (displayName: string) =>
    runAuthAction(async () => {
      await updateProfile(auth!.currentUser!, { displayName });
      // updateProfile doesn't trigger onAuthStateChanged, so consumers would
      // not see the new name without a manual refresh here. Keep the real
      // Firebase User: its methods (getIdToken, reload, ...) live on the
      // prototype, so a spread copy `{ ...currentUser }` has none of them and
      // every later `user.getIdToken()` (quizzes, flashcards, chat, ...)
      // would throw. Re-render through the revision counter instead.
      setUser(auth!.currentUser);
      setProfileRevision((r) => r + 1);
    });

  const changePassword = (currentPassword: string, newPassword: string) =>
    runAuthAction(async () => {
      const current = auth!.currentUser;
      if (!current?.email) {
        throw new Error('No signed-in email/password account.');
      }
      const credential = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, credential);
      await updatePassword(current, newPassword);
    });

  const deleteAccount = (currentPassword?: string) =>
    runAuthAction(async () => {
      const current = auth!.currentUser;
      if (!current) throw new Error('No signed-in user.');
      if (currentPassword && current.email) {
        const credential = EmailAuthProvider.credential(current.email, currentPassword);
        await reauthenticateWithCredential(current, credential);
      } else if (current.providerData.some((p) => p.providerId === 'google.com')) {
        await reauthenticateWithPopup(current, new GoogleAuthProvider());
      }

      // Delete all Firestore/Storage data before the Auth account - if this
      // fails, the account stays intact rather than being deleted with the
      // data left behind (the original bug this replaces).
      // Force a refresh so the token carries the sign-in that just happened.
      const token = await current.getIdToken(true);
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to delete your data. Try again.');
      }

      const uid = current.uid;
      await deleteUser(current);
      // Local-only study sessions belong to the account that was just deleted.
      clearSessions(uid);
      await clearOfflineData();
    });

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        resetPassword,
        signInWithGoogle,
        signOut,
        updateDisplayName,
        changePassword,
        deleteAccount,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
