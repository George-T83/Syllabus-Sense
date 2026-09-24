'use client';

import { useMemo, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { updateCourse } from '@/lib/firestore/courses';
import {
  createCourseGroup,
  getCourseGroup,
  joinCourseGroup,
  leaveCourseGroup,
  addCheckpoint,
  deleteCheckpoint,
  setConfirmation,
} from '@/lib/firestore/courseGroups';
import {
  useCourseGroupMembers,
  useCourseGroupCheckpoints,
  useCourseGroupConfirmations,
} from '@/lib/firestore/useCourseGroup';
import {
  formatInviteCodeForDisplay,
  normalizeInviteCodeInput,
} from '@/lib/courseGroups/inviteCode';
import { summarizeConfirmations } from '@/lib/courseGroups/confirmationSummary';
import type { Course } from '@/types/schedule';
import type { CourseGroup } from '@/types/courseGroup';

export interface SectionSyncCardProps {
  course: Course;
}

/** What a member is shown as to the rest of the group, given the app's own
 * existing display-name fallback (Navbar greets "Hi, {displayName || email
 * prefix}") - "real name" reuses that same fallback, "username" always uses
 * the email-prefix pseudonym regardless of whether a real display name is
 * set. */
function realNameFor(user: { displayName?: string | null; email?: string | null }): string {
  return user.displayName || user.email?.split('@')[0] || 'Student';
}
function usernameFor(user: { email?: string | null }): string {
  return user.email?.split('@')[0] || 'Student';
}

function NamePreferenceToggle({
  showRealName,
  onChange,
  realName,
  username,
}: {
  showRealName: boolean;
  onChange: (value: boolean) => void;
  realName: string;
  username: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        How should classmates see you?
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            showRealName
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/30'
          }`}
        >
          Real name
          <span className="block font-normal text-muted-foreground">{realName}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            !showRealName
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/30'
          }`}
        >
          Username
          <span className="block font-normal text-muted-foreground">{username}</span>
        </button>
      </div>
    </div>
  );
}

export function SectionSyncCard({ course }: SectionSyncCardProps) {
  const { dispatch } = useAppState();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const groupCode = course.groupCode;
  const members = useCourseGroupMembers(groupCode);
  const checkpoints = useCourseGroupCheckpoints(groupCode);
  const confirmations = useCourseGroupConfirmations(groupCode);

  const myMember = useMemo(() => members.find((m) => m.uid === user?.uid), [members, user?.uid]);

  // --- "not linked yet" flows ---
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [courseLabelDraft, setCourseLabelDraft] = useState(
    `${course.code} — ${course.title}${course.term ? ` — ${course.term}` : ''}`,
  );
  const [codeDraft, setCodeDraft] = useState('');
  const [previewGroup, setPreviewGroup] = useState<CourseGroup | null>(null);
  const [showRealNameDraft, setShowRealNameDraft] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!user || !courseLabelDraft.trim()) return;
    setBusy(true);
    try {
      const displayName = showRealNameDraft ? realNameFor(user) : usernameFor(user);
      const code = await createCourseGroup(
        user.uid,
        courseLabelDraft.trim(),
        displayName,
        showRealNameDraft,
      );
      await updateCourse(user.uid, course, { ...course, groupCode: code }, dispatch);
      showSuccess('Section Sync group created', 'Share the invite code with your classmates.');
      setMode('idle');
    } catch (err) {
      showError('Could not create a group', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewCode = async () => {
    const normalized = normalizeInviteCodeInput(codeDraft);
    if (!normalized) return;
    setBusy(true);
    try {
      const group = await getCourseGroup(normalized);
      if (!group) {
        showError('No group found for that code', 'Double-check the code and try again.');
        return;
      }
      setPreviewGroup(group);
    } catch (err) {
      showError('Could not look up that code', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !previewGroup) return;
    setBusy(true);
    try {
      const displayName = showRealNameDraft ? realNameFor(user) : usernameFor(user);
      await joinCourseGroup(previewGroup.code, user.uid, displayName, showRealNameDraft);
      await updateCourse(user.uid, course, { ...course, groupCode: previewGroup.code }, dispatch);
      showSuccess(
        'Joined Section Sync',
        `You're now syncing dates for "${previewGroup.courseLabel}".`,
      );
      setMode('idle');
      setPreviewGroup(null);
      setCodeDraft('');
    } catch (err) {
      showError('Could not join this group', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  // --- linked-group flows ---
  const [addingCheckpoint, setAddingCheckpoint] = useState(false);
  const [checkpointLabelDraft, setCheckpointLabelDraft] = useState('');
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const handleAddCheckpoint = async () => {
    if (!user || !groupCode || !checkpointLabelDraft.trim()) return;
    setBusy(true);
    try {
      await addCheckpoint(groupCode, user.uid, checkpointLabelDraft.trim());
      setCheckpointLabelDraft('');
      setAddingCheckpoint(false);
    } catch (err) {
      showError('Could not add checkpoint', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDate = async (checkpointId: string) => {
    if (!user || !groupCode || !myMember) return;
    const dateValue = dateDrafts[checkpointId];
    if (!dateValue) return;
    setBusy(true);
    try {
      await setConfirmation(groupCode, checkpointId, user.uid, myMember.displayName, dateValue);
    } catch (err) {
      showError('Could not confirm this date', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCheckpoint = async (checkpointId: string) => {
    if (!groupCode) return;
    try {
      await deleteCheckpoint(groupCode, checkpointId);
    } catch (err) {
      showError('Could not delete this checkpoint', err instanceof Error ? err.message : undefined);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !groupCode) return;
    setBusy(true);
    try {
      await leaveCourseGroup(groupCode, user.uid);
      // setDoc overwrites the whole document, and the Firestore client isn't
      // configured with ignoreUndefinedProperties - `groupCode: undefined`
      // would throw at write time, so the key has to be actually absent,
      // not just nulled out.
      const courseWithoutGroup: Course = { ...course };
      delete courseWithoutGroup.groupCode;
      await updateCourse(user.uid, course, courseWithoutGroup, dispatch);
      showSuccess('Left the group', 'You can rejoin anytime with the same invite code.');
    } catch (err) {
      showError('Could not leave the group', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!groupCode) {
    return (
      <Card className="rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Section Sync</h2>
            <p className="text-xs text-muted-foreground">
              Confirm due dates with classmates in this course - just a date signal, nothing else
              shared.
            </p>
          </div>
        </div>

        {mode === 'idle' && (
          <div className="flex flex-wrap gap-2">
            <CardActionButton variant="solid" withPlus onClick={() => setMode('create')}>
              Create a group
            </CardActionButton>
            <CardActionButton variant="ghost" onClick={() => setMode('join')}>
              Join with a code
            </CardActionButton>
          </div>
        )}

        {mode === 'create' && user && (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3.5">
            <div className="space-y-1.5">
              <label htmlFor="group-label" className="text-xs font-medium text-muted-foreground">
                Group name (shown to anyone previewing your invite code)
              </label>
              <input
                id="group-label"
                type="text"
                value={courseLabelDraft}
                onChange={(e) => setCourseLabelDraft(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <NamePreferenceToggle
              showRealName={showRealNameDraft}
              onChange={setShowRealNameDraft}
              realName={realNameFor(user)}
              username={usernameFor(user)}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setMode('idle')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={busy || !courseLabelDraft.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && user && (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3.5">
            {!previewGroup ? (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="join-code" className="text-xs font-medium text-muted-foreground">
                    Invite code
                  </label>
                  <input
                    id="join-code"
                    type="text"
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    placeholder="AB3D-EFGH"
                    className="w-full rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-mono uppercase tracking-wide text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setMode('idle')}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePreviewCode}
                    disabled={busy || !codeDraft.trim()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? 'Looking up…' : 'Find group'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-foreground">
                  You&apos;re about to join <strong>{previewGroup.courseLabel}</strong>.
                </p>
                <NamePreferenceToggle
                  showRealName={showRealNameDraft}
                  onChange={setShowRealNameDraft}
                  realName={realNameFor(user)}
                  username={usernameFor(user)}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPreviewGroup(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleJoin}
                    disabled={busy}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? 'Joining…' : 'Join group'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Section Sync</h2>
          <p className="text-xs text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''} · invite code{' '}
            <span className="font-mono font-semibold text-foreground">
              {formatInviteCodeForDisplay(groupCode)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!addingCheckpoint && (
            <CardActionButton variant="solid" withPlus onClick={() => setAddingCheckpoint(true)}>
              Add checkpoint
            </CardActionButton>
          )}
          <button
            onClick={handleLeaveGroup}
            disabled={busy}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            Leave
          </button>
        </div>
      </div>

      {addingCheckpoint && (
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-3">
          <input
            type="text"
            value={checkpointLabelDraft}
            onChange={(e) => setCheckpointLabelDraft(e.target.value)}
            placeholder='e.g. "Midterm 1"'
            className="flex-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => setAddingCheckpoint(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleAddCheckpoint}
            disabled={busy || !checkpointLabelDraft.trim()}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {checkpoints.length === 0 && !addingCheckpoint && (
        <EmptyState
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          title="No checkpoints yet"
          description='Add one for anything you want classmates to confirm a date for, like "Midterm 1."'
          action={{ label: '+ Add checkpoint', onClick: () => setAddingCheckpoint(true) }}
        />
      )}

      {checkpoints.length > 0 && (
        <div className="flex flex-col gap-2">
          {checkpoints.map((checkpoint) => {
            const checkpointConfirmations = confirmations.filter(
              (c) => c.checkpointId === checkpoint.id,
            );
            const tally = summarizeConfirmations(checkpointConfirmations);
            const myConfirmation = checkpointConfirmations.find((c) => c.uid === user?.uid);

            return (
              <div key={checkpoint.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{checkpoint.label}</span>
                  {checkpoint.createdBy === user?.uid && (
                    <button
                      onClick={() => handleDeleteCheckpoint(checkpoint.id)}
                      aria-label={`Delete ${checkpoint.label}`}
                      className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {tally.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tally.map((t) => (
                      <span
                        key={t.date}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                        title={t.displayNames.join(', ')}
                      >
                        {t.count} confirmed {t.date}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No one has confirmed a date yet.</p>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label={`Your date for ${checkpoint.label}`}
                    value={dateDrafts[checkpoint.id] ?? myConfirmation?.date ?? ''}
                    onChange={(e) =>
                      setDateDrafts((prev) => ({ ...prev, [checkpoint.id]: e.target.value }))
                    }
                    className="rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => handleConfirmDate(checkpoint.id)}
                    disabled={busy || !dateDrafts[checkpoint.id]}
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                  >
                    {myConfirmation ? 'Update my date' : 'Confirm my date'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {members.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {members.map((member) => (
            <span
              key={member.uid}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {member.displayName}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export default SectionSyncCard;
