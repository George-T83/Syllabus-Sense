import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignupPage from '../signup/page';
import LoginPage from '../login/page';
import { ToastProvider } from '@/components/ui/Toast';

const signUp = vi.fn();
let authError: string | null = null;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signUp,
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    error: authError,
    clearError: vi.fn(),
    user: null,
    loading: false,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function renderSignup() {
  render(
    <ToastProvider>
      <SignupPage />
    </ToastProvider>,
  );
}

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  authError = null;
  signUp.mockResolvedValue(true);
});

describe('sign-up form errors', () => {
  it('refuses a password under 6 characters and says so in an alert, without calling the server', async () => {
    renderSignup();
    fill('Email', 'a@b.co');
    fill('Password', '12345');
    fill('Confirm Password', '12345');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    const alert = await screen.findAllByRole('alert');
    expect(alert.some((a) => /at least 6 characters/.test(a.textContent ?? ''))).toBe(true);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('announces mismatched passwords as an alert', async () => {
    renderSignup();
    fill('Email', 'a@b.co');
    fill('Password', 'abcdef');
    fill('Confirm Password', 'abcdeg');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => /do not match/.test(a.textContent ?? ''))).toBe(true);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('accepts a 6-character password', async () => {
    renderSignup();
    fill('Email', 'a@b.co');
    fill('Password', 'abcdef');
    fill('Confirm Password', 'abcdef');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('a@b.co', 'abcdef'));
  });

  it('announces a server-side error from the auth layer', () => {
    authError = 'That email is already in use.';
    renderSignup();
    expect(screen.getByRole('alert').textContent).toContain('already in use');
  });
});

describe('sign-in form errors', () => {
  it('announces an error from the auth layer as an alert', () => {
    authError = 'Wrong email or password.';
    render(
      <ToastProvider>
        <LoginPage />
      </ToastProvider>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Wrong email or password');
  });
});
