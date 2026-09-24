import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileView } from '../ProfileView';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, Contact, ScheduleItem } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'user-1',
      email: 'student@example.com',
      displayName: 'Student',
      metadata: { creationTime: '2026-01-01T00:00:00.000Z' },
      providerData: [{ providerId: 'password' }],
    },
    updateDisplayName: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
    signOut: vi.fn(),
    error: null,
    clearError: vi.fn(),
  }),
}));

vi.mock('@/lib/firebase/client', () => ({
  db: {},
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockCourse: Course = {
  id: 'course-1',
  code: 'CS 301',
  title: 'Data Structures',
  instructor: 'Dr. Ada Lovelace',
  term: 'Fall 2026',
};

const mockScheduleItem: ScheduleItem = {
  id: 'item-1',
  courseId: 'course-1',
  title: 'Homework 1',
  type: 'assignment',
  dueDate: '2026-09-10',
  completed: false,
};

const mockContact: Contact = {
  id: 'contact-1',
  courseId: 'course-1',
  role: 'professor',
  fullName: 'Dr. Ada Lovelace',
};

function renderWithProviders(stateOverrides: Partial<AppState> = {}) {
  const initialState: Partial<AppState> = {
    courses: [],
    scheduleItems: [],
    contacts: [],
    moodEntries: [],
    selectedTerm: 'Fall 2026',
    ...stateOverrides,
  };

  return render(
    <ThemeProvider>
      <ToastProvider>
        <AppStateProvider initialState={initialState as AppState}>
          <ProfileView />
        </AppStateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('ProfileView - data export section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    // jsdom doesn't implement URL.createObjectURL/revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  it('disables the schedule and contacts export buttons when there is nothing to export', () => {
    renderWithProviders();

    const scheduleBtn = screen
      .getByText('Download schedule (.ics)')
      .closest('button') as HTMLButtonElement;
    const contactsBtn = screen
      .getByText('Download contacts (.vcf)')
      .closest('button') as HTMLButtonElement;
    expect(scheduleBtn.disabled).toBe(true);
    expect(contactsBtn.disabled).toBe(true);
  });

  it('enables and downloads a real .ics calendar from real schedule data', async () => {
    renderWithProviders({ courses: [mockCourse], scheduleItems: [mockScheduleItem] });

    const button = screen
      .getByText('Download schedule (.ics)')
      .closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    let capturedBlob: Blob | undefined;
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });

    fireEvent.click(button);

    expect(capturedBlob).toBeDefined();
    expect(capturedBlob!.type).toBe('text/calendar;charset=utf-8');
    const text = await capturedBlob!.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('CS 301: Homework 1');
  });

  it('enables and downloads a real .vcf bundle from real contact data', async () => {
    renderWithProviders({ courses: [mockCourse], contacts: [mockContact] });

    const button = screen
      .getByText('Download contacts (.vcf)')
      .closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    let capturedBlob: Blob | undefined;
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });

    fireEvent.click(button);

    expect(capturedBlob).toBeDefined();
    const text = await capturedBlob!.text();
    expect(text).toContain('BEGIN:VCARD');
    expect(text).toContain('Ada Lovelace');
  });

  it('describes the full scope of what gets exported, including mood and grade scenarios', () => {
    renderWithProviders();

    expect(
      screen.getByText(/mood check-in, grade scenario, syllabus, and preference/i),
    ).toBeDefined();
  });
});
