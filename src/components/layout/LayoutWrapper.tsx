'use client';

import React from 'react';
import { SidebarProvider } from './SidebarContext';
import { AppStateProvider } from '@/context/AppStateContext';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FirestoreSync from './FirestoreSync';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppStateProvider>
          <FirestoreSync />
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <div className="flex flex-1 pt-20">
              <Sidebar />
              <main className="flex-1 p-6 md:pl-72 md:p-8 max-w-7xl transition-all duration-300">
                {children}
              </main>
            </div>
          </div>
        </AppStateProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
