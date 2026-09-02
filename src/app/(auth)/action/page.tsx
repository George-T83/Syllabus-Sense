'use client';

import { useState, useEffect, Suspense, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import Logo from '@/components/layout/Logo';

function AuthActionHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [email, setEmail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(true);
  const [invalidCode, setInvalidCode] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!oobCode || mode !== 'resetPassword') {
      setVerifying(false);
      setInvalidCode(true);
      return;
    }

    if (!auth) {
      setVerifying(false);
      setInvalidCode(true);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setVerifying(false);
      })
      .catch(() => {
        setVerifying(false);
        setInvalidCode(true);
      });
  }, [mode, oobCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showError('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Passwords Do Not Match', 'Please make sure both password fields match.');
      return;
    }

    if (!auth || !oobCode) {
      showError('Invalid Session', 'Reset token missing or expired.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSubmitting(false);
      setCompleted(true);
      showSuccess('Password Updated', 'Your password has been reset successfully!');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch {
      setSubmitting(false);
      showError('Reset Failed', 'This reset link has expired or has already been used.');
    }
  };

  if (verifying) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <Logo className="h-10 w-10 animate-bounce mb-2" />
          <CardTitle>Verifying reset link...</CardTitle>
          <CardDescription>Please wait while we validate your security token.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (invalidCode) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <CardTitle>Invalid or Expired Link</CardTitle>
          <CardDescription>
            This password reset link is invalid, expired, or has already been used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link
            href="/login"
            className="w-full inline-flex justify-center items-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 transition-opacity hover:opacity-90"
          >
            Return to Sign In
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (completed) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle>Password Reset Complete</CardTitle>
          <CardDescription>
            Your password has been updated. Redirecting you to sign in...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="w-full inline-flex justify-center items-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5"
          >
            Sign In Now
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="flex items-center gap-2.5 mb-3 md:hidden">
          <Logo className="h-12 w-12" />
          <span className="text-2xl font-bold text-foreground tracking-tight">Syllabus Sense</span>
        </div>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>
          Create a new password for <span className="font-semibold text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Updating password...' : 'Update Password'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader className="items-center text-center">
            <Logo className="h-10 w-10 animate-bounce mb-2" />
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      }
    >
      <AuthActionHandler />
    </Suspense>
  );
}
