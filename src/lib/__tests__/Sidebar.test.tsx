import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { AppStateProvider } from '@/context/AppStateContext';

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppStateProvider>
        <Sidebar />
      </AppStateProvider>
    </SidebarProvider>,
  );
}

describe('Sidebar Active Route Highlighting', () => {
  it('highlights the active Dashboard route correctly', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    renderSidebar();

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const tasksLink = screen.getByRole('link', { name: /tasks/i });
    const profileLink = screen.getByRole('link', { name: /profile/i });

    // Verify active link attributes
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
    expect(dashboardLink.className).toContain('bg-gradient-brand');

    // Verify inactive links do not have active classes/attributes
    expect(tasksLink.getAttribute('aria-current')).toBeNull();
    expect(tasksLink.className).not.toContain('bg-gradient-brand');
    expect(profileLink.getAttribute('aria-current')).toBeNull();
    expect(profileLink.className).not.toContain('bg-gradient-brand');
  });

  it('highlights the active Tasks route correctly', () => {
    mockUsePathname.mockReturnValue('/tasks');

    renderSidebar();

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const tasksLink = screen.getByRole('link', { name: /tasks/i });

    expect(tasksLink.getAttribute('aria-current')).toBe('page');
    expect(tasksLink.className).toContain('bg-gradient-brand');

    expect(dashboardLink.getAttribute('aria-current')).toBeNull();
    expect(dashboardLink.className).not.toContain('bg-gradient-brand');
  });

  it('renders links for Courses, Tasks, and Calendar', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    renderSidebar();

    expect(screen.getByRole('link', { name: /courses/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /tasks/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /calendar/i })).toBeDefined();
  });

  it('groups nav items under Overview, Coursework, Planning, and You', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    renderSidebar();

    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Coursework')).toBeDefined();
    expect(screen.getByText('Planning')).toBeDefined();
    expect(screen.getByText('You')).toBeDefined();
  });
});
