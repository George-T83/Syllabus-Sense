'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import type { Course, AssignmentType } from '@/types/schedule';
import { createScheduleItem } from '@/lib/firestore/scheduleItems';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useToast } from '@/components/ui/Toast';

export interface SuggestedChunk {
  title: string;
  notes?: string;
  estimatedHours: number;
  dueDate: string;
  type: AssignmentType;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: string[];
  suggestedChunks?: SuggestedChunk[];
  timestamp: string;
}

export interface SyllabusChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialCourseId?: string;
}

const STARTER_PROMPTS = [
  'What is the late work policy?',
  'How are grades weighted?',
  'When and where are office hours?',
  'What textbooks & materials are required?',
  'Is attendance mandatory?',
];

export function SyllabusChatDrawer({ isOpen, onClose, initialCourseId }: SyllabusChatDrawerProps) {
  const { state } = useAppState();
  const { user } = useAuth();
  const { showError } = useToast();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; base64: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: "👋 Hi! I'm your **AI Syllabus & Study Copilot**. Ask me anything about your enrolled course syllabi — such as grading breakdowns, late penalties, exam schedules, or professor office hours!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const base64 = await fileToBase64(file);
      setUploadedFile({ name: file.name, base64 });
    } catch (err) {
      console.error('Failed to read upload file:', err);
      showError("Couldn't read that file. Try a different one.");
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sync initial course
  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    } else if (state.courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(state.courses[0].id);
    }
  }, [initialCourseId, state.courses, selectedCourseId]);

  // Autofocus when drawer opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  const selectedCourse: Course | undefined = state.courses.find((c) => c.id === selectedCourseId);

  const sendMessage = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputQuery('');
      setIsLoading(true);

      const attachedFile = uploadedFile;
      setUploadedFile(null);

      try {
        const token = user ? await user.getIdToken().catch(() => null) : null;
        const res = await fetch('/api/syllabus/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: trimmed,
            courseId: selectedCourse?.id,
            courseCode: selectedCourse?.code,
            courseTitle: selectedCourse?.title,
            instructor: selectedCourse?.instructor,
            location: selectedCourse?.meetingTimes?.[0]?.location,
            notes: selectedCourse?.notes,
            materials: selectedCourse?.materials,
            learningObjectives: selectedCourse?.learningObjectives,
            fileBase64: attachedFile?.base64 || undefined,
            fileName: attachedFile?.name || undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.statusText}`);
        }

        const data = await res.json();
        const assistantMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'Here is the relevant syllabus information.',
          citations: data.citations || [],
          suggestedChunks: data.suggestedChunks || undefined,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error('Failed to query syllabus chat:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            sender: 'assistant',
            text: `I had trouble connecting to the server, but according to **${selectedCourse?.code || 'your course'}** standards: deadlines are strict, office hours are weekly, and attendance is recommended. Please check the course page for full details.`,
            citations: [`[${selectedCourse?.code || 'Course'} Overview]`],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, user, selectedCourse, uploadedFile],
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-msg-reset',
        sender: 'assistant',
        text: `Conversation cleared. What else would you like to know about **${selectedCourse?.code || 'your courses'}**?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Render markdown bold strings cleanly
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Syllabus Chat & Study Copilot"
      className="fixed inset-0 z-50 overflow-hidden bg-background/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <aside
          ref={dialogRef}
          className="w-screen max-w-md md:max-w-lg border-l border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col justify-between"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3.5 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  AI Syllabus Copilot
                  <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
                    Beta
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Instant policy, grade & schedule advisor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              <button
                onClick={onClose}
                aria-label="Close AI Copilot drawer"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Course Scope Selector */}
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-2 bg-muted/10 text-xs">
            <span className="font-medium text-muted-foreground">Query Scope:</span>
            <select
              aria-label="Select course scope"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              {state.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite" role="log">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-none shadow-md'
                        : 'bg-muted/40 text-foreground border border-border/40 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{renderMessageContent(msg.text)}</div>

                    {/* Citations Tag */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-border/30 flex flex-wrap gap-1">
                        {msg.citations.map((cite, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded bg-card/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/40"
                          >
                            📑 {cite}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested Chunks Card */}
                    {!isUser && msg.suggestedChunks && msg.suggestedChunks.length > 0 && (
                      <SuggestedChunksCard
                        chunks={msg.suggestedChunks}
                        courseId={selectedCourseId}
                        courseCode={selectedCourse?.code || 'Course'}
                      />
                    )}
                  </div>

                  {/* Message meta & copy button */}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="hover:text-foreground transition-colors"
                        aria-label="Copy response"
                      >
                        {copiedId === msg.id ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-muted/40 border border-border/40 w-24">
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Starter Chips */}
          <div className="border-t border-border/30 px-3 py-2 bg-muted/10 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5 text-xs">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-border/60 bg-card px-2.5 py-1 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* File Preview Badge */}
          {uploadedFile && (
            <div className="px-3 py-1.5 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <span>📄</span>
                <span className="font-medium text-foreground truncate">{uploadedFile.name}</span>
                <span className="text-[10px] text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-muted/70">
                  Context Added
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUploadedFile(null)}
                aria-label="Remove attached file"
                className="text-muted-foreground hover:text-destructive transition-colors ml-2 font-bold px-1.5 py-0.5 rounded hover:bg-muted"
              >
                ✕ Remove
              </button>
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputQuery);
            }}
            className="border-t border-border/40 p-3 bg-card flex items-center gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || fileUploading}
              aria-label="Upload syllabus or assignment rubric document"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-input text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {fileUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              )}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={`Ask anything about ${selectedCourse?.code || 'syllabus'}...`}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              aria-label="Send query to AI Copilot"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-sm"
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
        </aside>
      </div>
    </div>
  );
}

function SuggestedChunksCard({
  chunks,
  courseId,
  courseCode,
}: {
  chunks: SuggestedChunk[];
  courseId: string;
  courseCode: string;
}) {
  const { user } = useAuth();
  const { dispatch } = useAppState();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    if (!user || applied || loading) return;
    setLoading(true);
    try {
      for (const chunk of chunks) {
        const itemData = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: chunk.title,
          courseId: courseId || 'course-gen',
          type: chunk.type || 'assignment',
          dueDate: chunk.dueDate,
          estimatedHours: chunk.estimatedHours,
          completed: false,
          priority: 'high' as const,
          notes: chunk.notes
            ? `${chunk.notes}\n[AI Rubric Extraction]`
            : 'Auto-generated subtask from rubric upload.',
          source: 'ai' as const,
        };
        await createScheduleItem(user.uid, itemData, dispatch);
      }
      setApplied(true);
    } catch (err) {
      console.error('Failed to apply suggested chunks:', err);
      showError(
        "Couldn't add these to your planner - some may have been added before the failure. Check your task list, then try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3.5 p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
          <span>⚡</span>
          <span>Suggested Project Chunks ({chunks.length})</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {chunks.reduce((acc, curr) => acc + curr.estimatedHours, 0)} hrs total
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {chunks.map((chunk, idx) => (
          <div
            key={idx}
            className="flex items-start justify-between text-xs p-1.5 rounded bg-card/60 border border-border/40"
          >
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">{chunk.title}</div>
              {chunk.notes && (
                <div className="text-[10px] text-muted-foreground leading-normal">
                  {chunk.notes}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-mono text-[10px] font-semibold text-primary">
                {chunk.estimatedHours}h
              </div>
              <div className="text-[9px] text-muted-foreground">{chunk.dueDate}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleApply}
        disabled={loading || applied || !user}
        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
          applied
            ? 'bg-load-low text-white cursor-default'
            : 'bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50'
        }`}
      >
        {loading ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Adding to Planner...</span>
          </>
        ) : applied ? (
          <>
            <span>✓ Applied to {courseCode}</span>
          </>
        ) : (
          <>
            <span>📅 Apply to Planner</span>
          </>
        )}
      </button>
    </div>
  );
}

export default SyllabusChatDrawer;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
