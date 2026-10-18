import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../login/page';
import { ToastProvider } from '@/components/ui/Toast';

const signIn = vi.fn();
const resetPassword = vi.fn();
const signInWithGoogle = vi.fn();
const clearError = vi.fn();
let mockAuth: {
  user: { uid: string } | null;
  loading: boolean;
  error: string | null;
};
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    ...mockAuth,
    signIn,
    resetPassword,
    signInWithGoogle,
    clearError,
  }),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function renderLogin() {
  return render(
    <ToastProvider>
      <LoginPage />
    </ToastProvider>,
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth = { user: null, loading: false, error: null };
  signIn.mockResolvedValue(true);
  resetPassword.mockResolvedValue(true);
  signInWithGoogle.mockResolvedValue(true);
});

describe('LoginPage sign in', () => {
  it('has labelled, required email and password fields with browser autofill hints', () => {
    renderLogin();
    const email = screen.getByLabelText('Email') as HTMLInputElement;
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.required).toBe(true);
    expect(email.autocomplete).toBe('email');
    expect(password.type).toBe('password');
    expect(password.required).toBe(true);
    expect(password.autocomplete).toBe('current-password');
  });

  it('links to sign up', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe('/signup');
  });

  it('signs in with the typed credentials and goes to the dashboard', async () => {
    renderLogin();
    fillAndSubmit('student@example.edu', 'hunter22');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(signIn).toHaveBeenCalledWith('student@example.edu', 'hunter22');
  });

  it('disables the button and says so while signing in', async () => {
    let resolveSignIn!: (ok: boolean) => void;
    signIn.mockReturnValue(new Promise<boolean>((r) => (resolveSignIn = r)));
    renderLogin();
    fillAndSubmit('a@b.co', 'secret1');
    const busy = (await screen.findByRole('button', {
      name: 'Signing in...',
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Continue with Google/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    resolveSignIn(true);
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('shows a Sign In Failed message and stays on the page for a wrong password', async () => {
    signIn.mockResolvedValue(false);
    renderLogin();
    fillAndSubmit('a@b.co', 'wrong');
    expect(await screen.findByText('Sign In Failed')).toBeDefined();
    expect(screen.getByText('Please check your email and password.')).toBeDefined();
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Sign In' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('keeps what the student typed after a failed attempt', async () => {
    signIn.mockResolvedValue(false);
    renderLogin();
    fillAndSubmit('a@b.co', 'wrong');
    await screen.findByText('Sign In Failed');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('a@b.co');
  });

  it('shows the auth provider error inline and clears it as soon as the student edits', () => {
    mockAuth.error = 'Too many attempts. Try again later.';
    renderLogin();
    expect(screen.getByText('Too many attempts. Try again later.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@y.zz' } });
    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it('does not call clearError when there is no error to clear', () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } });
    expect(clearError).not.toHaveBeenCalled();
  });

  it('sends an already-signed-in student straight to the dashboard', () => {
    mockAuth = { user: { uid: 'u1' }, loading: false, error: null };
    renderLogin();
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect while auth is still loading', () => {
    mockAuth = { user: { uid: 'u1' }, loading: true, error: null };
    renderLogin();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('LoginPage Google sign in', () => {
  it('goes to the dashboard on success', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows a specific failure message otherwise', async () => {
    signInWithGoogle.mockResolvedValue(false);
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByText('Google Sign In Failed')).toBeDefined();
    expect(screen.getByText('Unable to sign in with Google.')).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('LoginPage password reset', () => {
  function openReset() {
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  }

  it('switches to the reset form and back', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined();
    openReset();
    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeDefined();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue with Google/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '← Back to Sign In' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined();
  });

  it('asks for an email before sending when the field is empty', () => {
    renderLogin();
    openReset();
    // fireEvent.submit bypasses the browser's own `required` check.
    fireEvent.submit(screen.getByRole('button', { name: 'Send Reset Link' }).closest('form')!);
    expect(screen.getByText('Email Required')).toBeDefined();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sends the link and confirms the address it went to', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@school.edu' } });
    openReset();
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(await screen.findByText('Reset Link Sent')).toBeDefined();
    expect(resetPassword).toHaveBeenCalledWith('me@school.edu');
    expect(screen.getByText('Password reset instructions sent to me@school.edu.')).toBeDefined();
    expect(screen.getByText(/Password reset link has been sent to/)).toBeDefined();
  });

  it('tells the student when the reset email could not be sent', async () => {
    resetPassword.mockResolvedValue(false);
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@school.edu' } });
    openReset();
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(await screen.findByText('Reset Failed')).toBeDefined();
    expect(screen.queryByText(/Password reset link has been sent to/)).toBeNull();
  });

  it('hides the sent confirmation again after going back to sign in', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@school.edu' } });
    openReset();
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await screen.findByText(/Password reset link has been sent to/);
    fireEvent.click(screen.getByRole('button', { name: '← Back to Sign In' }));
    openReset();
    expect(screen.queryByText(/Password reset link has been sent to/)).toBeNull();
  });
});
