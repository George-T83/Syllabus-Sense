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
