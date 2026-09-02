'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Logo from '@/components/layout/Logo';

export default function LoginPage() {
  const { user, loading, signIn, resetPassword, signInWithGoogle, error, clearError } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const success = await signIn(email, password);
    setSubmitting(false);
    if (success) {
      router.push('/dashboard');
    } else {
      showError('Sign In Failed', 'Please check your email and password.');
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      showError('Email Required', 'Please enter your email address to reset password.');
      return;
    }
    setSubmitting(true);
    const success = await resetPassword(email);
    setSubmitting(false);
    if (success) {
      setResetSent(true);
      showSuccess('Reset Link Sent', `Password reset instructions sent to ${email}.`);
    } else {
      showError('Reset Failed', 'Unable to send reset email. Please verify the address.');
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const success = await signInWithGoogle();
    setSubmitting(false);
    if (success) {
      router.push('/dashboard');
    } else {
      showError('Google Sign In Failed', 'Unable to sign in with Google.');
    }
  };

  return (
    <Card>
      <CardHeader className="items-center text-center">
        {/* The brand panel ((auth)/layout.tsx) carries the primary logo
            moment on desktop; this stays visible only on mobile, where that
            panel is hidden and the card is the user's only orientation cue. */}
        <div className="flex items-center gap-2.5 mb-3 md:hidden">
          <Logo className="h-12 w-12" />
          <span className="text-2xl font-bold text-foreground tracking-tight">Syllabus Sense</span>
        </div>
        <CardTitle>{isResetMode ? 'Reset password' : 'Welcome back'}</CardTitle>
        <CardDescription>
          {isResetMode
            ? 'Enter your email address to receive password reset instructions'
            : 'Sign in to your Syllabus Sense account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
            {error}
          </div>
        )}

        {isResetMode ? (
          <form onSubmit={handleResetPassword} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) clearError();
                }}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {resetSent ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Password reset link has been sent to <strong>{email}</strong>. Check your inbox and
                follow the link to reset your password.
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Sending email...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsResetMode(false);
                setResetSent(false);
                if (error) clearError();
              }}
              className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline py-1"
            >
              ← Back to Sign In
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) clearError();
                  }}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      if (error) clearError();
                    }}
                    className="text-xs font-semibold text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
