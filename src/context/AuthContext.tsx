'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
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
   * Deletes the signed-in Firebase Auth account via `deleteUser`. Also a
   * "sensitive" operation subject to the same recent-login requirement as
   * `changePassword` - `currentPassword` is required for email/password
   * accounts (re-authenticated the same way) and optional/unused for
   * Google-auth accounts, where `deleteUser` alone succeeds if the session
   * is fresh enough or otherwise surfaces `auth/requires-recent-login` for
   * the caller to handle.
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
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

  const signInWithGoogle = () =>
    runAuthAction(() => signInWithPopup(auth!, new GoogleAuthProvider()));

  const signOut = () => runAuthAction(() => firebaseSignOut(auth!));

  const updateDisplayName = (displayName: string) =>
    runAuthAction(async () => {
      await updateProfile(auth!.currentUser!, { displayName });
      // updateProfile doesn't trigger onAuthStateChanged, so the cached user
      // object won't reflect the new name without a manual refresh here.
      setUser(auth!.currentUser ? { ...auth!.currentUser } : null);
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
      }
      await deleteUser(current);
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
