'use client';

import React from 'react';
import { SidebarProvider } from './SidebarContext';
import { AppStateProvider } from '@/context/AppStateContext';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileTabBar from './MobileTabBar';
import FirestoreSync from './FirestoreSync';
import OfflineBanner from './OfflineBanner';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
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
              {/* DA-1 (dashboard mobile-overflow audit finding): `main` is a
                  flex item of the row above (Sidebar + main) but had no
                  min-w-0, so its default `min-width: auto` floors it at the
                  min-content size of whatever page it renders - on the
                  dashboard specifically, several header rows and unwrapped
                  flex children that were happy to truncate/wrap at a real
                  375px width instead forced `main` (and the whole page)
                  wider than the viewport, verified via
                  `document.documentElement.scrollWidth` (549px) vs
                  `window.innerWidth` (375px) at that breakpoint. No
                  restructuring inside the page content itself can fix this -
                  the missing min-w-0 is on this flex item, not a descendant -
                  confirmed empirically that adding it here alone resolves
                  the overflow with no other changes needed. */}
              <main className="min-w-0 flex-1 p-6 pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)] md:pl-72 md:p-8 md:pb-8 max-w-7xl transition-all duration-300">
                {children}
              </main>
            </div>
            <MobileTabBar />
          </div>
        </AppStateProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
