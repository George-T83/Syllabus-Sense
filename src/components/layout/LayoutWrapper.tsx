'use client';

import React from 'react';
import { SidebarProvider } from './SidebarContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { AppStateProvider } from '@/context/AppStateContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ThemeProvider>
        <AppStateProvider>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <div className="flex flex-1 pt-20">
              <Sidebar />
              <main className="flex-1 p-6 md:pl-72 md:p-8 max-w-7xl mx-auto w-full transition-all duration-300">
                {children}
              </main>
            </div>
          </div>
        </AppStateProvider>
      </ThemeProvider>
    </SidebarProvider>
  );
}
