import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PlannerView } from '@/components/schedule/PlannerView';
import { ContactsListView } from '@/components/contacts/ContactsListView';
import Navbar from '@/components/layout/Navbar';
import { CardActionButton, CardActionLink } from '@/components/ui/CardAction';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { AppStateProvider } from '@/context/AppStateContext';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-auth-domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project-id';

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({ uid: 'test-user', email: 'test@example.com', displayName: 'Test User' });
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const mockCourses: Course[] = [
  { id: 'c1', code: 'CSCI 101', title: 'Intro to CS', color: 'blue', term: 'Fall 2026' },
  { id: 'c2', code: 'MATH 201', title: 'Calculus II', color: 'emerald', term: 'Fall 2026' },
];

const mockItems: ScheduleItem[] = [
  {
    id: 't1',
    courseId: 'c1',
    title: 'Homework 1',
    type: 'assignment',
    dueDate: '2026-09-15T00:00:00.000Z',
    completed: false,
    priority: 'high',
  },
];

const mockContacts: Contact[] = [
  {
    id: 'cnt1',
    courseId: 'c1',
    role: 'professor',
    fullName: 'Dr. Ada Lovelace',
    email: 'ada@university.edu',
    term: 'Fall 2026',
    approved: true,
  },
];

describe('Item 21: Mobile Touch Targets Minimum 44x44px Audit', () => {
  it('PlannerView select filters and action buttons meet the 44px touch target requirement', () => {
    render(
      <AuthProvider>
        <ToastProvider>
          <AppStateProvider
            initialState={{ courses: mockCourses, scheduleItems: mockItems, initialized: true }}
          >
            <PlannerView />
          </AppStateProvider>
        </ToastProvider>
      </AuthProvider>,
    );

    // Verify all selects have min-h-[44px]
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(4);
    selects.forEach((select) => {
      expect(select.className).toContain('min-h-[44px]');
    });

    // Verify Edit and Delete buttons meet min-h-[44px] and min-w-[44px]
    const editBtn = screen.getByRole('button', { name: /Edit/i });
    expect(editBtn.className).toContain('min-h-[44px]');
    expect(editBtn.className).toContain('min-w-[44px]');

    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    expect(deleteBtn.className).toContain('min-h-[44px]');
    expect(deleteBtn.className).toContain('min-w-[44px]');
  });

  it('ContactsListView inputs, filters, and action buttons meet the 44px touch target requirement', () => {
    render(
      <AuthProvider>
        <AppStateProvider
          initialState={{
            courses: mockCourses,
            contacts: mockContacts,
            selectedTerm: 'Fall 2026',
            initialized: true,
          }}
        >
          <ToastProvider>
            <ContactsListView />
          </ToastProvider>
        </AppStateProvider>
      </AuthProvider>,
    );

    const searchInput = screen.getByPlaceholderText(/Search by name or course/i);
    expect(searchInput.className).toContain('min-h-[44px]');

    const termSelect = screen.getByRole('combobox');
    expect(termSelect.className).toContain('min-h-[44px]');

    const editBtn = screen.getByRole('button', { name: /Edit/i });
    expect(editBtn.className).toContain('min-h-[44px]');
    expect(editBtn.className).toContain('min-w-[44px]');

    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    expect(deleteBtn.className).toContain('min-h-[44px]');
    expect(deleteBtn.className).toContain('min-w-[44px]');
  });

  it('CardActionButton and CardActionLink enforce min-h-[44px] touch target', () => {
    render(
      <div>
        <CardActionButton onClick={() => {}}>Action Button</CardActionButton>
        <CardActionLink href="/test">Action Link</CardActionLink>
      </div>,
    );

    const button = screen.getByRole('button', { name: /Action Button/i });
    expect(button.className).toContain('min-h-[44px]');

    const link = screen.getByRole('link', { name: /Action Link/i });
    expect(link.className).toContain('min-h-[44px]');
  });

  it('Navbar action buttons satisfy 44x44px minimum touch targets', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <AppStateProvider initialState={{ courses: mockCourses, scheduleItems: mockItems }}>
            <Navbar />
          </AppStateProvider>
        </AuthProvider>
      </ThemeProvider>,
    );

    const searchBtn = screen.getByRole('button', { name: /Search courses and tasks/i });
    expect(searchBtn.className).toContain('min-h-[44px]');
    expect(searchBtn.className).toContain('min-w-[44px]');

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    expect(bellBtn.className).toContain('min-h-[44px]');
    expect(bellBtn.className).toContain('min-w-[44px]');

    const themeBtn = screen.getByRole('button', { name: /Switch to/i });
    expect(themeBtn.className).toContain('min-h-[44px]');
    expect(themeBtn.className).toContain('min-w-[44px]');

    const signOutBtn = screen.getByRole('button', { name: /Sign out/i });
    expect(signOutBtn.className).toContain('min-h-[44px]');
    expect(signOutBtn.className).toContain('min-w-[44px]');
  });

  it('MonthCalendar PeriodNav, export, and view switcher satisfy 44x44px touch targets', () => {
    render(
      <AuthProvider>
        <AppStateProvider initialState={{ courses: mockCourses, scheduleItems: mockItems }}>
          <MonthCalendar />
        </AppStateProvider>
      </AuthProvider>,
    );

    const prevBtn = screen.getByRole('button', { name: /Previous month/i });
    expect(prevBtn.className).toContain('min-h-[44px]');
    expect(prevBtn.className).toContain('min-w-[44px]');

    const todayBtn = screen.getByRole('button', { name: /Today/i });
    expect(todayBtn.className).toContain('min-h-[44px]');

    const nextBtn = screen.getByRole('button', { name: /Next month/i });
    expect(nextBtn.className).toContain('min-h-[44px]');
    expect(nextBtn.className).toContain('min-w-[44px]');

    const exportBtn = screen.getByTitle(/Download visible items as a .ics file/i);
    expect(exportBtn.className).toContain('min-h-[44px]');
    expect(exportBtn.className).toContain('min-w-[44px]');

    const monthModeBtn = screen.getByRole('button', { name: /^month$/i });
    expect(monthModeBtn.className).toContain('min-h-[44px]');
  });
});
