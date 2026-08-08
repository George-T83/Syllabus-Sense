import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('Sidebar Active Route Highlighting', () => {
  it('highlights the active Dashboard route correctly', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    render(
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>,
    );

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const scheduleLink = screen.getByRole('link', { name: /schedule/i });
    const profileLink = screen.getByRole('link', { name: /profile/i });

    // Verify active link attributes
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
    expect(dashboardLink.className).toContain('bg-primary');

    // Verify inactive links do not have active classes/attributes
    expect(scheduleLink.getAttribute('aria-current')).toBeNull();
    expect(scheduleLink.className).not.toContain('bg-primary');
    expect(profileLink.getAttribute('aria-current')).toBeNull();
    expect(profileLink.className).not.toContain('bg-primary');
  });

  it('highlights the active Schedule route correctly', () => {
    mockUsePathname.mockReturnValue('/schedule');

    render(
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>,
    );

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const scheduleLink = screen.getByRole('link', { name: /schedule/i });

    expect(scheduleLink.getAttribute('aria-current')).toBe('page');
    expect(scheduleLink.className).toContain('bg-primary');

    expect(dashboardLink.getAttribute('aria-current')).toBeNull();
    expect(dashboardLink.className).not.toContain('bg-primary');
  });
});
