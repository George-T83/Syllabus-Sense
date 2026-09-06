import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DegreeCompassView } from '../DegreeCompassView';
import { ToastProvider } from '@/components/ui/Toast';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

const { useDegreeProfileMock, useDegreeCoursesMock } = vi.hoisted(() => ({
  useDegreeProfileMock: vi.fn(),
  useDegreeCoursesMock: vi.fn(),
}));

vi.mock('@/lib/firestore/useDegreeCompass', () => ({
  useDegreeProfile: useDegreeProfileMock,
  useDegreeCourses: useDegreeCoursesMock,
}));

vi.mock('@/lib/firestore/degreeCompass', () => ({
  saveDegreeProfile: vi.fn(),
  saveDegreeCourse: vi.fn(),
  deleteDegreeCourse: vi.fn(),
}));

const profile: DegreeProfile = {
  majorName: 'Computer Science',
  categories: [
    { id: 'core', name: 'Major Core', creditsRequired: 30 },
    { id: 'genEd', name: 'General Education', creditsRequired: 36 },
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const courses: DegreeCourse[] = [
  {
    id: 'c1',
    term: 'Fall 2025',
    code: 'CS 101',
    credits: 4,
    categoryId: 'core',
    status: 'completed',
  },
];

function renderView() {
  return render(
    <ToastProvider>
      <DegreeCompassView />
    </ToastProvider>,
  );
}

describe('DegreeCompassView', () => {
  it('shows the setup form when the student has no degree profile yet', () => {
    useDegreeProfileMock.mockReturnValue({ profile: null, loading: false });
    useDegreeCoursesMock.mockReturnValue([]);

    renderView();

    expect(screen.getByText('Set up Degree Compass')).toBeDefined();
  });

  it('shows a loading state while the profile listener has not resolved yet', () => {
    useDegreeProfileMock.mockReturnValue({ profile: null, loading: true });
    useDegreeCoursesMock.mockReturnValue([]);

    renderView();

    expect(screen.getByText(/Loading Degree Compass/)).toBeDefined();
    expect(screen.queryByText('Set up Degree Compass')).toBeNull();
  });

  it('renders the Path view with overall progress once a profile exists', () => {
    useDegreeProfileMock.mockReturnValue({ profile, loading: false });
    useDegreeCoursesMock.mockReturnValue(courses);

    renderView();

    expect(screen.getByText('Computer Science')).toBeDefined();
    // 4 of 66 required credits completed
    expect(screen.getByText('4 / 66 credits (6%)')).toBeDefined();
    expect(screen.getAllByText('Fall 2025').length).toBeGreaterThan(0);
    expect(screen.getByText('CS 101')).toBeDefined();
  });

  it('switches to the Ledger view when its toggle is clicked', () => {
    useDegreeProfileMock.mockReturnValue({ profile, loading: false });
    useDegreeCoursesMock.mockReturnValue(courses);

    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));

    expect(screen.getByText('Major Core')).toBeDefined();
    expect(screen.getByText('General Education')).toBeDefined();
  });

  it('opens the add-course modal from the header action', () => {
    useDegreeProfileMock.mockReturnValue({ profile, loading: false });
    useDegreeCoursesMock.mockReturnValue(courses);

    renderView();

    fireEvent.click(screen.getByRole('button', { name: /Add course/ }));

    expect(screen.getByRole('dialog', { name: 'Add course' })).toBeDefined();
  });
});
