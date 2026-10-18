import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AuthActionPage from '../action/page';
import { ToastProvider } from '@/components/ui/Toast';

const verifyPasswordResetCode = vi.fn();
const confirmPasswordReset = vi.fn();
vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: (...args: unknown[]) => verifyPasswordResetCode(...args),
  confirmPasswordReset: (...args: unknown[]) => confirmPasswordReset(...args),
}));

let mockAuthClient: object | null;
vi.mock('@/lib/firebase/client', () => ({
  get auth() {
    return mockAuthClient;
  },
}));

let mockSearch: URLSearchParams;
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearch,
  useRouter: () => ({ push }),
}));

function renderAction(query: Record<string, string>) {
  mockSearch = new URLSearchParams(query);
  return render(
    <ToastProvider>
      <AuthActionPage />
    </ToastProvider>,
  );
}

const validLink = { mode: 'resetPassword', oobCode: 'code-123' };

async function renderValidForm() {
  verifyPasswordResetCode.mockResolvedValue('student@school.edu');
  renderAction(validLink);
  await screen.findByRole('heading', { name: 'Set New Password' });
}

function fillPasswords(a: string, b: string) {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: a } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: b } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthClient = { name: 'auth' };
  confirmPasswordReset.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthActionPage link checking', () => {
  it('says it is verifying while the code is checked', () => {
    verifyPasswordResetCode.mockReturnValue(new Promise(() => {}));
    renderAction(validLink);
    expect(screen.getByText('Verifying reset link...')).toBeDefined();
  });

  it('shows the form for the account the link belongs to', async () => {
    await renderValidForm();
    expect(verifyPasswordResetCode).toHaveBeenCalledWith({ name: 'auth' }, 'code-123');
    expect(screen.getByText('student@school.edu')).toBeDefined();
  });

  it.each([
    ['no params', {}],
    ['an unsupported mode', { mode: 'verifyEmail', oobCode: 'x' }],
    ['no code', { mode: 'resetPassword' }],
  ])('treats %s as an invalid link without contacting Firebase', async (_name, query) => {
    renderAction(query);
    expect(await screen.findByRole('heading', { name: 'Invalid or Expired Link' })).toBeDefined();
    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Return to Sign In' }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('treats an expired or used code as invalid', async () => {
    verifyPasswordResetCode.mockRejectedValue(new Error('auth/expired-action-code'));
    renderAction(validLink);
    expect(await screen.findByRole('heading', { name: 'Invalid or Expired Link' })).toBeDefined();
    expect(screen.queryByLabelText('New Password')).toBeNull();
  });

  it('treats a missing auth client as an invalid link', async () => {
    mockAuthClient = null;
    renderAction(validLink);
    expect(await screen.findByRole('heading', { name: 'Invalid or Expired Link' })).toBeDefined();
    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
  });
});

describe('AuthActionPage setting a new password', () => {
  it('requires six or more characters in both fields', async () => {
    await renderValidForm();
    for (const label of ['New Password', 'Confirm New Password']) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.required).toBe(true);
      expect(input.minLength).toBe(6);
    }
  });

  it('rejects a short password even if the browser check is bypassed', async () => {
    await renderValidForm();
    fillPasswords('12345', '12345');
    fireEvent.submit(screen.getByRole('button', { name: 'Update Password' }).closest('form')!);
    expect(screen.getByText('Password Too Short')).toBeDefined();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    await renderValidForm();
    fillPasswords('abcdef', 'abcdeg');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(screen.getByText('Passwords Do Not Match')).toBeDefined();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('resets the password, confirms it and returns to sign in after a short pause', async () => {
    await renderValidForm();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fillPasswords('new-secret', 'new-secret');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    });
    expect(confirmPasswordReset).toHaveBeenCalledWith({ name: 'auth' }, 'code-123', 'new-secret');
    expect(screen.getByRole('heading', { name: 'Password Reset Complete' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign In Now' }).getAttribute('href')).toBe('/login');
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('disables the button while the new password is being saved', async () => {
    await renderValidForm();
    let resolveReset!: () => void;
    confirmPasswordReset.mockReturnValue(new Promise<void>((r) => (resolveReset = r)));
    fillPasswords('new-secret', 'new-secret');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    const busy = (await screen.findByRole('button', {
      name: 'Updating password...',
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    resolveReset();
    await screen.findByRole('heading', { name: 'Password Reset Complete' });
  });

  it('explains a link that stopped working between opening and submitting', async () => {
    await renderValidForm();
    confirmPasswordReset.mockRejectedValue(new Error('auth/invalid-action-code'));
    fillPasswords('new-secret', 'new-secret');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(await screen.findByText('Reset Failed')).toBeDefined();
    expect(screen.getByText('This reset link has expired or has already been used.')).toBeDefined();
    // Still on the form, button usable again.
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Update Password' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
