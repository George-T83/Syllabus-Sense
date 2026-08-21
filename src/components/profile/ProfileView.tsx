'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateUserPreferences, type UserPreferences } from '@/lib/firestore/preferences';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** Sample tasks with no relation to the signed-in student's real courses -
 * used only to render a live Card vs. Touch comparison below, so the
 * choice can be judged by seeing it, not by reading a description. */
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
    label: 'Card',
    description: 'A tinted background per task and a bit more room - easiest to scan on a laptop.',
  },
  {
    value: 'touch',
    label: 'Touch',
    description: 'A top accent bar and a large circular checkbox - built for tapping on a phone.',
  },
];

const PREFERENCE_ROWS: {
  key: Exclude<keyof UserPreferences, 'taskRowVariant'>;
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

export function ProfileView() {
  const { user, error, updateDisplayName, signOut, clearError } = useAuth();
  const { state, dispatch } = useAppState();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  // Read from AppStateContext (kept live by useFirestoreSync's `users/{uid}`
  // listener) rather than opening a second onSnapshot here - one realtime
  // subscription per account, shared by every view that reads a preference.
  const { preferences } = state;

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

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  const joined = user.metadata.creationTime
    ? dateFormatter.format(new Date(user.metadata.creationTime))
    : 'Unknown';

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account details.</p>
      </div>

      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="h-24 bg-gradient-brand" />
        <div className="px-6 pb-6">
          {/* Only the avatar straddles the banner seam (by design - it has
              its own ring-4 ring-card border so it reads fine against
              either side). The name/email/Edit row sits entirely below the
              banner, fully on the card's solid background, so text is never
              split across the gradient and white halves. */}
          <div className="-mt-10 flex items-end justify-between">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-2xl font-bold text-white shadow-lg ring-4 ring-card">
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
              <div className="text-sm text-muted-foreground">{user.email}</div>
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

          {error && (
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

      <Card className="rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <SectionIcon icon="tasks" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Task Row Style</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              How every task looks across Dashboard, Tasks, Planner, and Calendar - on this device
              and every other one you sign into.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          Applied instantly, saved to your account, and synced to any other device you&apos;re
          signed into in real time - no page refresh needed on either end.
        </p>
      </Card>

      <Card className="rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <SectionIcon icon="settings" />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Preferences &amp; Notifications
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Study habits and notification settings.
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-border border-t border-border">
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
              <Toggle checked={preferences[row.key]} />
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          Notifications aren&apos;t sent yet, so these are off for everyone. Your preference is
          still saved for when they launch.
        </p>
      </Card>

      <button
        onClick={handleSignOut}
        className="w-full rounded-lg border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        Sign out
      </button>
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
