'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const PREFERENCE_ROWS: { label: string; description: string; defaultOn: boolean }[] = [
  {
    label: 'Daily digest email',
    description: "A morning summary of what's due today.",
    defaultOn: true,
  },
  {
    label: 'Deadline reminders',
    description: "Get notified 24 hours before something's due.",
    defaultOn: true,
  },
  {
    label: 'Weekly workload recap',
    description: 'A Sunday night look at the week ahead.',
    defaultOn: false,
  },
];

export function ProfileView() {
  const { user, error, updateDisplayName, signOut, clearError } = useAuth();
  const { state } = useAppState();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

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
        <div className="flex items-center justify-between gap-3">
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
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
            Coming soon
          </span>
        </div>

        <div className="mt-5 divide-y divide-border border-t border-border">
          {PREFERENCE_ROWS.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-3.5 opacity-60"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.description}</div>
              </div>
              <ToggleMock checked={row.defaultOn} />
            </div>
          ))}
        </div>
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

/** Visual-only toggle used to preview the not-yet-built preferences UI - no
 * onClick, so it never implies a setting can actually be changed yet. */
function ToggleMock({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary/50' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </span>
  );
}
