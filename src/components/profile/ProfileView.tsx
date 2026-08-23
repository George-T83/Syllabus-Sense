'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateUserPreferences, type UserPreferences } from '@/lib/firestore/preferences';
import { COURSE_COLOR_PRESETS } from '@/lib/courseColors';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const DELETE_CONFIRM_PHRASE = 'DELETE';

/** Sample tasks with no relation to the signed-in student's real courses -
 * used only to render a live Comfortable vs. Touch comparison below, so
 * the choice can be judged by seeing it, not by reading a description. */
const PREVIEW_TASKS = [
  {
    title: 'Problem Set 4',
    type: 'assignment' as const,
    courseCode: 'MATH 201',
    courseColor: 'bg-blue-500',
    courseIcon: 'calculator',
    completed: false,
    priority: 'high' as const,
  },
  {
    title: 'Lab Report: Titration',
    type: 'project' as const,
    courseCode: 'CHEM 110',
    courseColor: 'bg-teal-500',
    courseIcon: 'flask',
    completed: false,
    progress: 55,
  },
];

const ROW_VARIANT_OPTIONS: {
  value: UserPreferences['taskRowVariant'];
  label: string;
  description: string;
}[] = [
  {
    value: 'card',
    label: 'Comfortable',
    description: 'A tinted background per task and a bit more room - easiest to scan on a laptop.',
  },
  {
    value: 'touch',
    label: 'Touch',
    description: 'A top accent bar and a large circular checkbox - built for tapping on a phone.',
  },
];

/** Real, stored preferences shown as disabled toggles below - notification
 * delivery itself hasn't shipped yet (see the honesty note under the
 * list), so every row here is intentionally rendered in its OFF position
 * regardless of what value is actually stored. The stored value is left
 * alone (other code may read it once delivery ships); this is purely about
 * not showing a switch that looks live when nothing is being sent. */
const PREFERENCE_ROWS: {
  key: Exclude<keyof UserPreferences, 'taskRowVariant' | 'avatarColor'>;
  label: string;
  description: string;
}[] = [
  {
    key: 'dailyDigest',
    label: 'Daily digest email',
    description: "A morning summary of what's due today.",
  },
  {
    key: 'deadlineReminders',
    label: 'Deadline reminders',
    description: "Get notified 24 hours before something's due.",
  },
  {
    key: 'weeklyRecap',
    label: 'Weekly workload recap',
    description: 'A Sunday night look at the week ahead.',
  },
];

/** `.edu` email domain -> a small read-only "this is your school" badge.
 * Real signal (no backend needed): a proper school/LMS connection is a
 * separate, larger feature (see the Canvas-sync row below), but showing
 * what we can already infer costs nothing and reads as "we noticed",
 * not "we built integrations". */
function institutionFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain || !domain.endsWith('.edu')) return null;
  return domain;
}

/** Email/password accounts carry a 'password' entry in providerData;
 * Google-only accounts don't, and have no password here to change. */
function hasPasswordProvider(providerData: { providerId: string }[]): boolean {
  return providerData.some((p) => p.providerId === 'password');
}

export function ProfileView() {
  const { user, error, updateDisplayName, changePassword, deleteAccount, signOut, clearError } =
    useAuth();
  const { state, dispatch } = useAppState();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  // Read from AppStateContext (kept live by useFirestoreSync's `users/{uid}`
  // listener) rather than opening a second onSnapshot here - one realtime
  // subscription per account, shared by every view that reads a preference.
  const { preferences } = state;

  // --- Account & Data: password change (email/password accounts only) ---
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);

  // --- Account & Data: delete account ---
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  if (!user) return null;

  const handleSelectRowVariant = async (variant: UserPreferences['taskRowVariant']) => {
    const next = { ...preferences, taskRowVariant: variant };
    // Optimistic: every TaskRow on screen (including the previews below)
    // switches instantly. The write below persists it to the account and
    // realtime-syncs it to any other open session; onSnapshot reconciles
    // this optimistic value with the server's shortly after regardless.
    dispatch({ type: 'SET_PREFERENCES', payload: next });
    try {
      await updateUserPreferences(user.uid, next);
    } catch {
      // Non-fatal: the realtime listener will correct the UI to whatever
      // actually made it to Firestore if this particular write failed.
    }
  };

  const handleSelectAvatarColor = async (color: string | undefined) => {
    const next = { ...preferences, avatarColor: color };
    dispatch({ type: 'SET_PREFERENCES', payload: next });
    try {
      await updateUserPreferences(user.uid, next);
    } catch {
      // Non-fatal, same as row-style above: onSnapshot reconciles.
    }
  };

  const avatarClass = preferences.avatarColor || 'bg-gradient-brand';
  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  const joined = user.metadata.creationTime
    ? dateFormatter.format(new Date(user.metadata.creationTime))
    : 'Unknown';
  const institution = institutionFromEmail(user.email);
  const canChangePassword = hasPasswordProvider(user.providerData);

  const pendingCount = state.scheduleItems.filter((i) => !i.completed).length;
  const completedCount = state.scheduleItems.length - pendingCount;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const success = await updateDisplayName(name.trim());
    setSaving(false);
    if (success) setEditing(false);
  };

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) router.push('/login');
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordFormError(null);
    clearError();
    if (newPassword.length < 6) {
      setPasswordFormError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFormError('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    const success = await changePassword(currentPassword, newPassword);
    setPasswordSaving(false);
    if (success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setChangingPassword(false);
      setTimeout(() => setPasswordSuccess(false), 4000);
    }
  };

  const handleDownloadData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        displayName: user.displayName,
        memberSince: user.metadata.creationTime ?? null,
      },
      courses: state.courses,
      scheduleItems: state.scheduleItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `syllabus-sense-data-${user.uid}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deleteReady =
    deleteConfirmText === DELETE_CONFIRM_PHRASE &&
    (!canChangePassword || deletePassword.length > 0);

  const handleDeleteAccount = async () => {
    if (!deleteReady) return;
    setDeleteSubmitting(true);
    const success = await deleteAccount(canChangePassword ? deletePassword : undefined);
    setDeleteSubmitting(false);
    if (success) router.push('/login');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your identity, notifications, and account security - all in one place.
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl p-0" data-testid="identity-card">
        <div className="h-24 bg-gradient-brand" />
        <div className="px-6 pb-6">
          {/* Only the avatar straddles the banner seam (by design - it has
              its own ring-4 ring-card border so it reads fine against
              either side). The name/email/Edit row sits entirely below the
              banner, fully on the card's solid background, so text is never
              split across the gradient and white halves. */}
          <div className="-mt-10 flex items-end justify-between">
            <div
              className={cn(
                'flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg ring-4 ring-card',
                avatarClass,
              )}
            >
              {initial}
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {!editing && (
            <div className="mt-3">
              <div className="text-lg font-semibold text-foreground">
                {user.displayName || 'No display name set'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{user.email}</span>
                {institution && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {institution}
                  </span>
                )}
              </div>
            </div>
          )}

          {editing && (
            <form onSubmit={handleSave} className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError();
                }}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={saving}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(user.displayName ?? '');
                  clearError();
                }}
                className="text-xs font-medium text-muted-foreground hover:underline"
              >
                Cancel
              </button>
            </form>
          )}

          {error && !changingPassword && !deleting && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-center">
              <div className="text-xl font-bold text-primary">{state.courses.length}</div>
              <div className="text-[10px] font-medium text-muted-foreground">Courses</div>
            </div>
            <div className="rounded-xl border border-load-medium/30 bg-load-medium/10 p-3 text-center">
              <div className="text-xl font-bold text-load-medium">{pendingCount}</div>
              <div className="text-[10px] font-medium text-muted-foreground">Pending</div>
            </div>
            <div className="rounded-xl border border-load-low/30 bg-load-low/10 p-3 text-center">
              <div className="text-xl font-bold text-load-low">{completedCount}</div>
              <div className="text-[10px] font-medium text-muted-foreground">Done</div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span className="font-medium text-foreground">{joined}</span>
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------------------
          Appearance - visual/cosmetic controls only. Dark mode stays in
          the header (Navbar) for now; bringing it here is a natural
          follow-up, not attempted in this pass. */}
      <SectionHeading icon="tasks" title="Appearance" description="How the app looks for you." />

      <Card className="rounded-2xl p-6" data-testid="appearance-card">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Task row style</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How every task looks across Dashboard, Tasks, Planner, and Calendar - on this device and
            every other one you sign into.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROW_VARIANT_OPTIONS.map((option) => {
            const selected = preferences.taskRowVariant === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelectRowVariant(option.value)}
                aria-pressed={selected}
                className={cn(
                  'rounded-2xl border-2 p-3.5 text-left transition-colors',
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/60',
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-transparent',
                    )}
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </div>
                <div className="pointer-events-none flex flex-col gap-2">
                  {PREVIEW_TASKS.map((task) => (
                    <TaskRow key={task.title} variant={option.value} {...task} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Applied instantly, saved to your account, and synced to any other device you&apos;re
          signed into in real time - no page refresh needed on either end.
        </p>

        <div className="mt-5 border-t border-border pt-4" data-testid="avatar-color-picker">
          <h3 className="text-sm font-semibold text-foreground">Avatar color</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pick a color for your initial above - the same palette your courses use.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectAvatarColor(undefined)}
              aria-pressed={!preferences.avatarColor}
              title="Default gradient"
              className={cn(
                'h-8 w-8 rounded-full bg-gradient-brand ring-2 ring-offset-2 ring-offset-card transition-shadow',
                !preferences.avatarColor ? 'ring-primary' : 'ring-transparent hover:ring-border',
              )}
            />
            {COURSE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleSelectAvatarColor(preset.value)}
                aria-pressed={preferences.avatarColor === preset.value}
                title={preset.value.replace('bg-', '').replace('-500', '')}
                className={cn(
                  'h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-card transition-shadow',
                  preset.value,
                  preferences.avatarColor === preset.value
                    ? 'ring-primary'
                    : 'ring-transparent hover:ring-border',
                )}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------------------
          Notifications - real, granular preferences are stored, but
          nothing is actually sent yet. Every switch below is rendered in
          its OFF position regardless of the stored value, specifically so
          it never visually contradicts that fact. */}
      <SectionHeading
        icon="settings"
        title="Notifications"
        description="What you'll hear from us, once delivery ships."
      />

      <Card className="rounded-2xl p-6" data-testid="notifications-card">
        <div className="divide-y divide-border">
          {PREFERENCE_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{row.label}</span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Coming soon
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{row.description}</div>
              </div>
              {/* Always OFF: nothing is sent yet, so nothing should ever
                  appear switched on here, no matter what's stored. */}
              <Toggle checked={false} />
            </div>
          ))}

          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Canvas sync</span>
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Pull due dates and announcements straight from Canvas.
              </div>
            </div>
            {/* Deliberately no control here - an informational row, not a
                switch, so this reads as roadmap rather than a hidden
                fake toggle. */}
          </div>
        </div>

        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          Notifications haven&apos;t shipped yet, so nothing above is actually being sent -
          that&apos;s why every switch shows off. Your selection is still saved for the day they do.
        </p>
      </Card>

      {/* ---------------------------------------------------------------
          Account & Data - the real security/data controls this page was
          missing: password change, a data export, and account deletion. */}
      <SectionHeading
        icon="shield"
        title="Account & Data"
        description="Security and control over what we hold on you."
      />

      <Card className="rounded-2xl p-6 space-y-5" data-testid="account-data-card">
        {/* Password change - email/password accounts only. */}
        <div data-testid="password-section">
          <h3 className="text-sm font-semibold text-foreground">Password</h3>
          {canChangePassword ? (
            <>
              {!changingPassword && !passwordSuccess && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Change your account password.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setChangingPassword(true);
                      setPasswordFormError(null);
                      clearError();
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Change password
                  </button>
                </div>
              )}

              {passwordSuccess && !changingPassword && (
                <p className="mt-2 rounded-lg border border-load-low/30 bg-load-low/10 px-3 py-2 text-sm text-load-low">
                  Password updated.
                </p>
              )}

              {changingPassword && (
                <form onSubmit={handleChangePassword} className="mt-3 space-y-2.5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Current password
                    </label>
                    <input
                      type="password"
                      autoFocus
                      required
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordFormError(null);
                        clearError();
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      New password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordFormError(null);
                        clearError();
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordFormError(null);
                        clearError();
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {(passwordFormError || error) && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {passwordFormError || error}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {passwordSaving ? 'Updating...' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setPasswordFormError(null);
                        clearError();
                      }}
                      className="text-xs font-medium text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              You sign in with Google, so there&apos;s no separate Syllabus Sense password to change
              here - manage it from your Google Account instead.
            </p>
          )}
        </div>

        {/* Data export - client-side only, reads what's already in AppState. */}
        <div className="border-t border-border pt-5" data-testid="data-export-section">
          <h3 className="text-sm font-semibold text-foreground">Your data</h3>
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Download every course and task in your account as a JSON file.
            </p>
            <button
              type="button"
              onClick={handleDownloadData}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Download my data
            </button>
          </div>
        </div>

        {/* Account deletion - the only genuinely destructive action on this
            page, styled to look like it: solid red panel, type-to-confirm. */}
        <div
          className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4"
          data-testid="delete-account-panel"
        >
          <h3 className="text-sm font-semibold text-destructive">Delete account</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes your Syllabus Sense sign-in. This cannot be undone.
          </p>

          {!deleting ? (
            <button
              type="button"
              onClick={() => {
                setDeleting(true);
                setDeleteConfirmText('');
                setDeletePassword('');
                clearError();
              }}
              className="mt-3 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              Delete account
            </button>
          ) : (
            <div className="mt-3 space-y-2.5">
              {canChangePassword && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Current password
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value);
                      clearError();
                    }}
                    className="mt-1 w-full rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Type {DELETE_CONFIRM_PHRASE} to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={DELETE_CONFIRM_PHRASE}
                  className="mt-1 w-full rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!deleteReady || deleteSubmitting}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Deleting...' : 'Permanently delete my account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleting(false);
                    setDeleteConfirmText('');
                    setDeletePassword('');
                    clearError();
                  }}
                  className="text-xs font-medium text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Sign-out is routine, not destructive - neutral styling. Red is
          reserved for the delete-account action above. */}
      <button
        onClick={handleSignOut}
        data-testid="sign-out-button"
        className="w-full rounded-lg border border-border bg-accent/40 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
      >
        Sign out
      </button>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: Parameters<typeof SectionIcon>[0]['icon'];
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <SectionIcon icon={icon} />
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled="true"
      disabled
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full opacity-50 transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
