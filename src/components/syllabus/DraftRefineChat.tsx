'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  describePatch,
  type DraftPatch,
  type RefineChatMessage,
  type RefineDraftFields,
} from '@/lib/syllabus/refineDraft';

/**
 * Lets a student finalize the extracted course by talking to the assistant
 * instead of only editing the fields above by hand - "this is actually a
 * 4-credit course" is faster to type than hunting down the right box. Any
 * field it changes is applied through the same `onApplyPatch` callback the
 * review form itself uses, so nothing here bypasses the course-level state
 * the rest of the review step already manages.
 */
export interface DraftRefineChatProps {
  draft: RefineDraftFields;
  onApplyPatch: (patch: DraftPatch) => void;
  disabled?: boolean;
}

interface LogEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function DraftRefineChat({ draft, onApplyPatch, disabled }: DraftRefineChatProps) {
  const { user } = useAuth();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const historyRef = useRef<RefineChatMessage[]>([]);

  const send = async () => {
    const message = input.trim();
    if (!message || sending || disabled) return;

    setLog((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: message }]);
    setInput('');
    setSending(true);

    try {
      const token = user ? await user.getIdToken().catch(() => null) : null;
      const res = await fetch('/api/syllabus/refine-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ draft, message, history: historyRef.current }),
      });
      if (!res.ok) throw new Error(`Refine API error: ${res.statusText}`);

      const data: { reply?: string; patch?: DraftPatch } = await res.json();
      const reply = data.reply || 'Done.';

      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: message } satisfies RefineChatMessage,
        { role: 'assistant', content: reply } satisfies RefineChatMessage,
      ].slice(-12);

      if (data.patch) onApplyPatch(data.patch);

      setLog((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.patch ? `${reply}\n${describePatch(data.patch)}` : reply,
        },
      ]);
    } catch (err) {
      console.error('Failed to refine syllabus draft:', err);
      setLog((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          text: "I couldn't reach the server, so nothing changed. Try again, or edit the fields above directly.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10">
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2">
        <span className="text-xs font-semibold text-foreground">
          Tell the assistant what to fix
        </span>
        <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
          Beta
        </span>
      </div>

      {log.length > 0 && (
        <div className="max-h-40 space-y-2 overflow-y-auto px-3 py-2" aria-live="polite" role="log">
          {log.map((entry) => (
            <div key={entry.id} className={entry.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={cn(
                  'inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-2.5 py-1.5 text-xs leading-relaxed',
                  entry.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/40 bg-card text-foreground',
                )}
              >
                {entry.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-1.5 p-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. this is actually a 4-credit course"
          disabled={disabled || sending}
          aria-label="Tell the assistant what to fix about this course"
          className="flex-1 rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || !input.trim()}
          aria-label="Send"
          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {sending ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          )}
        </button>
      </form>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">
        Only affects the fields above - schedule and contacts have their own review.
      </p>
    </div>
  );
}
