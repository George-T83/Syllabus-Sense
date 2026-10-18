'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CardActionButton } from '@/components/ui/CardAction';
import { ConfirmDeleteInline } from '@/components/ui/ConfirmDeleteInline';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';

type FeedState = 'loading' | 'unavailable' | 'ready';

/**
 * Subscribable calendar link for the Profile "Your data" area. The link holds
 * a secret token that the server maps to this account; resetting it issues a
 * new token and the old URL stops working.
 */
export function CalendarFeedSection() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [status, setStatus] = useState<FeedState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Held in a ref so the initial load runs once per account, not on every
  // render that hands back a fresh user object.
  const userRef = useRef(user);
  userRef.current = user;
  const uid = user?.uid;

  const request = useCallback(async (method: 'GET' | 'POST' | 'DELETE'): Promise<Response> => {
    const current = userRef.current;
    if (!current || typeof current.getIdToken !== 'function') throw new Error('Not signed in');
    const idToken = await current.getIdToken();
    return fetch('/api/calendar/feed', {
      method,
      headers: { Authorization: `Bearer ${idToken}` },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await request('GET');
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { token: string | null };
        if (cancelled) return;
        setToken(data.token);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, uid]);

  const feedUrl =
    token && typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/${token}` : '';

  const createOrReset = async (isReset: boolean) => {
    setBusy(true);
    try {
      const res = await request('POST');
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setConfirmingReset(false);
      showSuccess(isReset ? 'New calendar link created.' : 'Calendar link created.');
    } catch {
      showError("Couldn't update your calendar link. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const res = await request('DELETE');
      if (!res.ok) throw new Error(String(res.status));
      setToken(null);
      setConfirmingReset(false);
      showSuccess('Calendar link turned off.');
    } catch {
      showError("Couldn't turn off your calendar link. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      showSuccess('Calendar link copied.');
    } catch {
      showError("Couldn't copy the link. Select it and copy it by hand.");
    }
  };

  return (
    <div className="mt-5" data-testid="calendar-feed-section">
      <h4 className="text-sm font-semibold text-foreground">Calendar feed</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your schedule to Google, Apple or Outlook Calendar once and it stays up to date. Anyone
        with the link can see your course names, due dates and notes, so do not share it.
      </p>

      {status === 'unavailable' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Calendar feeds aren&apos;t available right now.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {token && (
            <input
              readOnly
              aria-label="Calendar feed link"
              value={feedUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!token ? (
              <CardActionButton
                variant="solid"
                onClick={() => createOrReset(false)}
                disabled={busy || status === 'loading'}
              >
                {busy ? 'Creating...' : 'Create link'}
              </CardActionButton>
            ) : confirmingReset ? (
              <ConfirmDeleteInline
                deleting={busy}
                size="lg"
                message="Reset link? The old link stops working."
                confirmLabel="Reset"
                confirmingLabel="Resetting..."
                onConfirm={() => createOrReset(true)}
                onCancel={() => setConfirmingReset(false)}
              />
            ) : (
              <>
                <CardActionButton variant="solid" onClick={copy} disabled={busy}>
                  Copy link
                </CardActionButton>
                <CardActionButton onClick={() => setConfirmingReset(true)} disabled={busy}>
                  Reset link
                </CardActionButton>
                <CardActionButton onClick={turnOff} disabled={busy}>
                  Turn off
                </CardActionButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
