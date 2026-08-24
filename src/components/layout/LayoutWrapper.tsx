'use client';

import React, { useState, useEffect } from 'react';
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

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    // URL flag to open chat drawer directly for screenshot capture / deep linking
    if (typeof window !== 'undefined' && window.location.search.includes('chat=true')) {
      setIsChatOpen(true);
    }
  }, []);

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppStateProvider>
          <FirestoreSync />
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <OfflineBanner />
            <Navbar onOpenChat={() => setIsChatOpen(true)} />
            <div className="flex flex-1 pt-20">
              <Sidebar />
              <main className="min-w-0 flex-1 p-6 pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)] md:pl-72 md:p-8 md:pb-8 max-w-7xl transition-all duration-300">
                {children}
              </main>
            </div>
            <MobileTabBar />
            
            {/* Global Floating AI Copilot Drawer Trigger */}
            <button
              onClick={() => setIsChatOpen(true)}
              aria-label="Open AI Syllabus Copilot Chat"
              className="fixed bottom-20 right-5 z-40 flex items-center gap-2 rounded-full border border-primary/30 bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xl transition-all hover:scale-105 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary md:bottom-6 md:right-6"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>AI Copilot Chat</span>
            </button>

            <SyllabusChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            <PomodoroTimer />
          </div>
        </AppStateProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
