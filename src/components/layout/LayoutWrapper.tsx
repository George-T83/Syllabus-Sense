'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from './SidebarContext';
import { AppStateProvider } from '@/context/AppStateContext';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import MobileTabBar from './MobileTabBar';
import FirestoreSync from './FirestoreSync';
import OfflineBanner from './OfflineBanner';
import { SyllabusChatDrawer } from '@/components/syllabus/SyllabusChatDrawer';
import { FloatingActionPill } from '@/components/ui/FloatingActionPill';
import { usePillHidden } from '@/hooks/useDisplayPrefs';
import { PomodoroTimer } from '@/components/focus/PomodoroTimer';
import { usePlatform } from '@/hooks/usePlatformKey';
import { ShortcutsCheatSheet } from '@/components/common/ShortcutsCheatSheet';
import { matchesShortcut } from '@/lib/shortcuts';
import { FOCUS_TASK_EVENT, type FocusTaskEventDetail } from '@/lib/focus/focusTaskEvent';

// The AI Advisor chat answers questions about a student's enrolled course syllabi -
// it needs a course in scope to be coherent, and silently falls back to
// `state.courses[0]` when there isn't one. Account/settings pages have no
// course context at all, so the trigger, drawer, and its Alt+A shortcut
// stay off those routes rather than floating over unrelated content.
const COPILOT_EXCLUDED_ROUTES = ['/profile'];

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Incremented (never read for its value) to force PomodoroTimer open from
  // the CommandPalette's "Start Pomodoro" action - see PomodoroTimer's
  // `openSignal` prop.
  const [pomodoroOpenSignal, setPomodoroOpenSignal] = useState(0);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | undefined>(undefined);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { alt: altKey } = usePlatform();
  const [advisorPillHidden, setAdvisorPillHidden] = usePillHidden('advisor');
  const [focusPillHidden] = usePillHidden('focus');

  const handleCommandPaletteAction = (actionId: string) => {
    if (actionId === 'ai-copilot') setIsChatOpen(true);
    if (actionId === 'shortcuts') setIsShortcutsOpen(true);
    if (actionId === 'pomodoro') {
      // A generic "start a session" request, distinct from a task-scoped
      // deep link below - clears any task left over from a previous
      // Calendar-initiated session rather than silently carrying it into
      // an unrelated one.
      setPomodoroTaskId(undefined);
      setPomodoroOpenSignal((n) => n + 1);
    }
  };

  // Focus Mode Deep Link: any page (currently just Calendar) can ask the
  // one global PomodoroTimer to open pre-scoped to a specific task by
  // dispatching this event - see lib/focus/focusTaskEvent.ts.
  useEffect(() => {
    const handleFocusTask = (e: Event) => {
      const { taskId } = (e as CustomEvent<FocusTaskEventDetail>).detail;
      setPomodoroTaskId(taskId);
      setPomodoroOpenSignal((n) => n + 1);
    };
    window.addEventListener(FOCUS_TASK_EVENT, handleFocusTask);
    return () => window.removeEventListener(FOCUS_TASK_EVENT, handleFocusTask);
  }, []);
  const pathname = usePathname();
  const copilotAvailable = !COPILOT_EXCLUDED_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`),
  );

  // Room at the foot of the page for whichever floating buttons are showing,
  // so the last line of content is never stuck underneath one.
  const pillsShowing = (copilotAvailable && !advisorPillHidden) || !focusPillHidden;

  useEffect(() => {
    // URL flag to open chat drawer directly for screenshot capture / deep linking
    if (typeof window !== 'undefined' && window.location.search.includes('chat=true')) {
      setIsChatOpen(true);
    }
  }, []);

  // Alt+A → open the AI Advisor chat (only where it is available). Cmd/Ctrl+K
  // belongs to the command palette, which lists "Ask the AI Advisor" too.
  useEffect(() => {
    if (!copilotAvailable) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, 'advisor')) {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copilotAvailable]);

  // "?" opens the shortcut cheat sheet (ignored while typing in a field).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, 'shortcuts')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Leaving a route where the Copilot isn't offered should also close it,
  // rather than leaving it open-but-invisible in the background.
  useEffect(() => {
    if (!copilotAvailable) setIsChatOpen(false);
  }, [copilotAvailable]);

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppStateProvider>
          <FirestoreSync />
          <div className="min-h-screen flex flex-col text-foreground">
            <OfflineBanner />
            <Navbar onCommandPaletteAction={handleCommandPaletteAction} />
            <div className="flex flex-1 pt-20">
              <Sidebar />
              <main
                className={cn(
                  'min-w-0 flex-1 p-6 md:pl-72 md:p-8 md:pb-8 max-w-7xl transition-all duration-300',
                  pillsShowing
                    ? 'pb-[calc(9rem+env(safe-area-inset-bottom))]'
                    : 'pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)]',
                )}
              >
                {children}
              </main>
            </div>
            <MobileTabBar />

            {/* Global Floating AI Advisor Drawer Trigger - only on routes with
                course context; see COPILOT_EXCLUDED_ROUTES above. */}
            {copilotAvailable && !advisorPillHidden && (
              <FloatingActionPill
                onClick={() => setIsChatOpen(true)}
                ariaLabel={`Open AI Advisor chat (${altKey}+A)`}
                positionClassName="bottom-20 right-5 z-40 md:bottom-6 md:right-6"
                colorClassName="border-indigo-400/30 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 shadow-[0_8px_25px_rgba(99,102,241,0.4)] hover:shadow-[0_12px_30px_rgba(99,102,241,0.6)] focus:ring-indigo-400"
                icon={
                  <svg
                    className="h-4 w-4 text-violet-200"
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
                }
                label="AI Advisor"
                shortcut={`${altKey}+A`}
                onDismiss={() => setAdvisorPillHidden(true)}
                dismissLabel={`Hide the AI Advisor button (${altKey}+A still opens it; Profile > Appearance brings it back)`}
              />
            )}

            <SyllabusChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            <ShortcutsCheatSheet open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
            <PomodoroTimer taskId={pomodoroTaskId} openSignal={pomodoroOpenSignal} />
          </div>
        </AppStateProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
