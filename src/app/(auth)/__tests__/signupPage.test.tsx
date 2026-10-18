import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignupPage from '../signup/page';
import { ToastProvider } from '@/components/ui/Toast';

const signUp = vi.fn();
const signInWithGoogle = vi.fn();
const clearError = vi.fn();
let mockError: string | null;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ signUp, signInWithGoogle, clearError, error: mockError }),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function renderSignup() {
  return render(
    <ToastProvider>
      <SignupPage />
    </ToastProvider>,
  );
}

function fill(email: string, password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirm } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockError = null;
  signUp.mockResolvedValue(true);
  signInWithGoogle.mockResolvedValue(true);
});

describe('SignupPage', () => {
  it('has three labelled required fields; the passwords are marked as new-password', () => {
    renderSignup();
    expect((screen.getByLabelText('Email') as HTMLInputElement).required).toBe(true);
    for (const name of ['Password', 'Confirm Password']) {
      const input = screen.getByLabelText(name) as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.required).toBe(true);
      expect(input.autocomplete).toBe('new-password');
    }
  });

  it('links back to sign in', () => {
    renderSignup();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
  });

  it('creates the account and goes to the dashboard', async () => {
    renderSignup();
    fill('new@school.edu', 'correct-horse', 'correct-horse');
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(signUp).toHaveBeenCalledWith('new@school.edu', 'correct-horse');
  });

  it('refuses mismatched passwords with an inline message and a toast, without calling signUp', () => {
    renderSignup();
    fill('new@school.edu', 'correct-horse', 'correct-horsE');
    submit();
    expect(screen.getAllByText('Passwords do not match.')).toHaveLength(2);
    expect(screen.getByText('Validation Error')).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('clears the mismatch message once the student edits a field', () => {
    renderSignup();
    fill('new@school.edu', 'abc123', 'abc124');
    submit();
    // Inline message plus the toast.
    expect(screen.getAllByText('Passwords do not match.')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'abc123' } });
    // Only the toast (which times out on its own) is left.
    expect(screen.getAllByText('Passwords do not match.')).toHaveLength(1);
  });

  it('can submit after fixing the mismatch', async () => {
    renderSignup();
    fill('new@school.edu', 'abc123', 'abc124');
    submit();
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'abc123' } });
    submit();
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('new@school.edu', 'abc123'));
  });

  it('shows Sign Up Failed and stays on the page when the account cannot be created', async () => {
    signUp.mockResolvedValue(false);
    renderSignup();
    fill('taken@school.edu', 'abc123', 'abc123');
    submit();
    expect(await screen.findByText('Sign Up Failed')).toBeDefined();
    expect(screen.getByText('Unable to create account with provided details.')).toBeDefined();
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Sign Up' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('disables the form button while creating the account', async () => {
    let resolveSignUp!: (ok: boolean) => void;
    signUp.mockReturnValue(new Promise<boolean>((r) => (resolveSignUp = r)));
    renderSignup();
    fill('a@b.co', 'abc123', 'abc123');
    submit();
    const busy = (await screen.findByRole('button', {
      name: 'Creating account...',
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    resolveSignUp(true);
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('shows the auth provider error inline (for example a weak password) and clears it on edit', () => {
    mockError = 'Password should be at least 6 characters.';
    renderSignup();
    expect(screen.getByText('Password should be at least 6 characters.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longer-one' } });
    expect(clearError).toHaveBeenCalled();
  });

  it('supports Google sign-up, and reports its failure', async () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));

    push.mockClear();
    signInWithGoogle.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByText('Google Sign Up Failed')).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });
});
