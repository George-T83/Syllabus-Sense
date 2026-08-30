'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from './SidebarContext';
import { AppStateProvider } from '@/context/AppStateContext';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileTabBar from './MobileTabBar';
import FirestoreSync from './FirestoreSync';
import OfflineBanner from './OfflineBanner';
import { SyllabusChatDrawer } from '@/components/syllabus/SyllabusChatDrawer';
import { PomodoroTimer } from '@/components/focus/PomodoroTimer';
import { usePlatformKey } from '@/hooks/usePlatformKey';

// The Copilot answers questions about a student's enrolled course syllabi -
// it needs a course in scope to be coherent, and silently falls back to
// `state.courses[0]` when there isn't one. Account/settings pages have no
// course context at all, so the trigger, drawer, and its Cmd+K shortcut
// stay off those routes rather than floating over unrelated content.
const COPILOT_EXCLUDED_ROUTES = ['/profile'];

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const modKey = usePlatformKey();
  const pathname = usePathname();
  const copilotAvailable = !COPILOT_EXCLUDED_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`),
  );

  useEffect(() => {
    // URL flag to open chat drawer directly for screenshot capture / deep linking
    if (typeof window !== 'undefined' && window.location.search.includes('chat=true')) {
      setIsChatOpen(true);
    }
  }, []);

  // Global Cmd+K / Ctrl+K → open AI Copilot chat (only where the Copilot is available)
  useEffect(() => {
    if (!copilotAvailable) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copilotAvailable]);

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
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <OfflineBanner />
            <Navbar />
            <div className="flex flex-1 pt-20">
              <Sidebar />
              <main className="min-w-0 flex-1 p-6 pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)] md:pl-72 md:p-8 md:pb-8 max-w-7xl transition-all duration-300">
                {children}
              </main>
            </div>
            <MobileTabBar />

            {/* Global Floating AI Copilot Drawer Trigger - only on routes with
                course context; see COPILOT_EXCLUDED_ROUTES above. */}
            {copilotAvailable && (
              <button
                onClick={() => setIsChatOpen(true)}
                aria-label="Open AI Syllabus Copilot Chat"
                className="fixed bottom-20 right-5 z-40 flex items-center gap-2.5 rounded-full border border-indigo-400/30 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_25px_rgba(99,102,241,0.4)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:shadow-[0_12px_30px_rgba(99,102,241,0.6)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 md:bottom-6 md:right-6"
              >
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </div>
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
                <span className="font-bold tracking-wide">AI Copilot</span>
                <span className="hidden rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono text-white/90 sm:inline-block">
                  {modKey}+K
                </span>
              </button>
            )}

            <SyllabusChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            <PomodoroTimer />
          </div>
        </AppStateProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
