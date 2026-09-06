'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useDegreeProfile, useDegreeCourses } from '@/lib/firestore/useDegreeCompass';
import { appendAdvisorMessage, useAdvisorMessages } from '@/lib/firestore/advisor';
import { summarizeAdvisorContext } from '@/lib/advisor/buildContext';
import type { AdvisorMessage } from '@/types/advisor';
import { AdvisorWarningCard } from './AdvisorWarningCard';
import { cn } from '@/lib/utils';

const WELCOME_MESSAGE =
  "Hi — I'm your AI Advisor. I can reason over your Degree Compass plan, your courses, and your tasks - not just one syllabus. Ask me what to take next, whether you're on track, or what a change would mean for your plan.";

const MAX_HISTORY_SENT = 8;
const RECENT_QUESTIONS_SHOWN = 3;

function ChatBubble({ message }: { message: AdvisorMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-body-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-accent/60 text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.warning && <AdvisorWarningCard warning={message.warning} />}
      </div>
    </div>
  );
}

export function AdvisorView() {
  const { user } = useAuth();
  const { state } = useAppState();
  const { showError } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { profile: degreeProfile, loading: degreeLoading } = useDegreeProfile(user?.uid);
  const degreeCourses = useDegreeCourses(user?.uid);
  const { messages, loading: messagesLoading } = useAdvisorMessages(user?.uid);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const autoSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(
    () =>
      summarizeAdvisorContext({
        degreeProfile,
        degreeCourses,
        courses: state.courses,
        pendingTaskCount: 0,
        overdueTaskCount: 0,
      }),
    [degreeProfile, degreeCourses, state.courses],
  );

  const recentQuestions = useMemo(() => {
    const userQuestions = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const distinct = Array.from(new Set(userQuestions)).reverse();
    // Skip the most recent question - it's already visible at the bottom of
    // the transcript, so repeating it in "Recent Questions" would just be
    // the same text twice on screen at once.
    return distinct.slice(1, 1 + RECENT_QUESTIONS_SHOWN);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!user || !text.trim() || sending) return;
    setSending(true);

    const userMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const now = Date.now();
    const pendingTaskCount = state.scheduleItems.filter((i) => !i.completed).length;
    const overdueTaskCount = state.scheduleItems.filter(
      (i) => !i.completed && new Date(i.dueDate).getTime() < now,
    ).length;

    try {
      await appendAdvisorMessage(user.uid, userMessage);
      setInput('');

      const token = await user.getIdToken();
      const history = [...messages, userMessage]
        .slice(-MAX_HISTORY_SENT - 1, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          degreeProfile,
          degreeCourses,
          courses: state.courses.map((c) => ({ code: c.code, title: c.title, term: c.term })),
          pendingTaskCount,
          overdueTaskCount,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The Advisor request failed.');

      const assistantMessage: AdvisorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: body.reply,
        ...(body.highStakes ? { warning: body.highStakes } : {}),
        createdAt: new Date().toISOString(),
      };
      await appendAdvisorMessage(user.uid, assistantMessage);
    } catch (err) {
      showError(
        "Couldn't reach the Advisor",
        err instanceof Error ? err.message : 'Try again in a moment.',
      );
    } finally {
      setSending(false);
    }
  };

  // Direction C's dashboard nudge deep-links here with ?prompt=... - opening
  // it should ask that exact question immediately, not just pre-fill the
  // input box and wait for another click. Waiting on `degreeLoading` matters
  // here specifically: without it, this effect fires as soon as `user` is
  // set, which is well before the Degree Compass onSnapshot listeners
  // (subscribed in the same render) have delivered their first snapshot -
  // the auto-sent question would reason over an empty plan every time,
  // exactly the case a manually-typed question a few seconds later doesn't
  // hit.
  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt && !autoSentRef.current && user && !degreeLoading) {
      autoSentRef.current = true;
      sendMessage(prompt);
      router.replace('/advisor');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, degreeLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card className="flex h-[70vh] flex-col rounded-2xl p-4 sm:p-6">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {!messagesLoading && messages.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-accent/60 px-4 py-3 text-body-sm text-foreground">
                {WELCOME_MESSAGE}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-accent/60 px-4 py-3 text-body-sm text-muted-foreground">
                Thinking…
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex items-center gap-2 border-t border-border pt-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your degree, GPA, or what to take next…"
            disabled={sending}
            className="min-h-[44px] flex-1 rounded-full border border-border bg-background px-4 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
            </svg>
          </button>
        </form>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-2xl p-4">
          <h2 className="mb-3 text-label font-semibold uppercase tracking-wide text-muted-foreground">
            Reasoning over
          </h2>
          <dl className="space-y-2 text-body-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Degree Compass</dt>
              <dd
                className={cn(
                  'font-semibold',
                  summary.degreeConnected ? 'text-load-low' : 'text-muted-foreground',
                )}
              >
                {degreeLoading ? '…' : summary.degreeConnected ? 'Connected' : 'Not set up'}
              </dd>
            </div>
            {summary.degreeConnected && (
              <>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Completed terms</dt>
                  <dd className="font-semibold text-foreground">{summary.completedTerms}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Overall credits</dt>
                  <dd className="font-semibold text-foreground">
                    {summary.creditsCompleted + summary.creditsInProgress} /{' '}
                    {summary.creditsRequired}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </Card>

        {recentQuestions.length > 0 && (
          <Card className="rounded-2xl p-4">
            <h2 className="mb-3 text-label font-semibold uppercase tracking-wide text-muted-foreground">
              Recent questions
            </h2>
            <ul className="space-y-2">
              {recentQuestions.map((q, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => sendMessage(q)}
                    disabled={sending}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-caption text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-50"
                  >
                    &ldquo;{q}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
