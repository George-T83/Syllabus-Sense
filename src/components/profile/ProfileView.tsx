'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

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

      <Card accent className="rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xl font-bold text-white">
            {initial}
          </div>
          {editing ? (
            <form onSubmit={handleSave} className="flex-1 flex items-center gap-2">
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
          ) : (
            <div className="flex-1 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {user.displayName || 'No display name set'}
                </div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
          <div>
            <div className="text-lg font-bold text-primary">{state.courses.length}</div>
            <div className="text-[10px] text-muted-foreground">Courses</div>
          </div>
          <div>
            <div className="text-lg font-bold text-load-medium">{pendingCount}</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </div>
          <div>
            <div className="text-lg font-bold text-load-low">{completedCount}</div>
            <div className="text-[10px] text-muted-foreground">Done</div>
          </div>
        </div>

        <div className="flex justify-between text-sm border-t border-border mt-4 pt-4">
          <span className="text-muted-foreground">Member since</span>
          <span className="text-foreground">{joined}</span>
        </div>
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
        <p className="text-sm text-muted-foreground mt-3">Coming soon.</p>
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
