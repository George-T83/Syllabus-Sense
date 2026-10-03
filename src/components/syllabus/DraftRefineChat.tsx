'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  describePatch,
  needsIntake,
  type DraftPatch,
  type RefineChatMessage,
  type RefineDraftFields,
} from '@/lib/syllabus/refineDraft';
import { aiRequestErrorFrom, describeAiFailure } from '@/lib/ai/requestFailure';

/**
 * Lets a student finalize a course by talking to the assistant instead of
 * only editing the fields above by hand - "this is actually a 4-credit
 * course" is faster to type than hunting down the right box. The same panel
 * also handles a course with no syllabus at all: when Code and Title are
 * still blank it opens with a greeting and the assistant proactively asks
 * for what's missing, rather than waiting for a correction to react to.
 * Any field it changes is applied through the same `onApplyPatch` callback
 * the review form itself uses, so nothing here bypasses the course-level
 * state the rest of the review step already manages. Bubble/input
 * treatment mirrors `SyllabusChatDrawer` so this doesn't read as a second,
 * unrelated chat surface a few fields below the first one.
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

const INTAKE_GREETING =
  "Let's set up this course. What's the course code and title? Instructor, term, and credit hours help too, if you know them.";

export function DraftRefineChat({ draft, onApplyPatch, disabled }: DraftRefineChatProps) {
  const { user } = useAuth();
  // Only checked once, at mount: a draft that starts with no Code or Title
  // gets a proactive greeting; one that arrives already filled in (from an
  // extracted syllabus) doesn't. Whether the *live* prompt should keep
  // asking is a separate, per-message decision the API route makes from
  // the current draft, not from this frozen flag.
  const [startedEmpty] = useState(() => needsIntake(draft));
  const [log, setLog] = useState<LogEntry[]>(() =>
    startedEmpty ? [{ id: 'greeting', role: 'assistant', text: INTAKE_GREETING }] : [],
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const historyRef = useRef<RefineChatMessage[]>([]);
  const intakeMode = needsIntake(draft);

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
      if (!res.ok) throw await aiRequestErrorFrom(res);

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
          text: `${describeAiFailure(err).message} Nothing changed. You can also edit the fields above directly.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/10">
      <div className="flex items-center gap-2.5 border-b border-border/40 bg-muted/20 px-3.5 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-foreground">
              {intakeMode
                ? 'Set up this course with the assistant'
                : 'Tell the assistant what to fix'}
            </span>
            <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-xs font-semibold text-primary">
              Beta
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {intakeMode
              ? 'e.g. “CSCI 213, Computer Science I, Dr. Alvarez”'
              : 'e.g. “this is actually a 4-credit course”'}
          </p>
        </div>
      </div>

      {log.length > 0 && (
        <div className="max-h-56 space-y-3 overflow-y-auto p-3.5" aria-live="polite" role="log">
          {log.map((entry) => {
            const isUser = entry.role === 'user';
            return (
              <div key={entry.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-relaxed',
                    isUser
                      ? 'rounded-br-none bg-primary text-primary-foreground shadow-md'
                      : 'rounded-bl-none border border-border/40 bg-card text-foreground shadow-sm',
                  )}
                >
                  {entry.text}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-none border border-border/40 bg-card p-3 shadow-sm">
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-border/30 p-2.5"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            intakeMode
              ? 'e.g. CSCI 213, Computer Science I'
              : 'e.g. this is actually a 4-credit course'
          }
          disabled={disabled || sending}
          aria-label={
            intakeMode
              ? 'Tell the assistant about this course'
              : 'Tell the assistant what to fix about this course'
          }
          className="flex-1 rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || !input.trim()}
          aria-label="Send"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
      <p className="px-3.5 pb-3 text-xs text-muted-foreground">
        Only affects the fields above - schedule and contacts have their own review.
      </p>
    </div>
  );
}
