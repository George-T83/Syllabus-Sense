import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionSyncCard } from '../SectionSyncCard';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course } from '@/types/schedule';
import type {
  CourseGroupMember,
  CourseGroupCheckpoint,
  CheckpointConfirmation,
} from '@/types/courseGroup';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', email: 'student@example.com', displayName: 'Ada Student' },
  }),
}));

let mockMembers: CourseGroupMember[] = [];
let mockCheckpoints: CourseGroupCheckpoint[] = [];
let mockConfirmations: CheckpointConfirmation[] = [];

vi.mock('@/lib/firestore/useCourseGroup', () => ({
  useCourseGroupMembers: () => mockMembers,
  useCourseGroupCheckpoints: () => mockCheckpoints,
  useCourseGroupConfirmations: () => mockConfirmations,
}));

vi.mock('@/lib/firestore/courseGroups', () => ({
  createCourseGroup: vi.fn(),
  getCourseGroup: vi.fn(),
  joinCourseGroup: vi.fn(),
  leaveCourseGroup: vi.fn(),
  addCheckpoint: vi.fn(),
  deleteCheckpoint: vi.fn(),
  setConfirmation: vi.fn(),
}));

vi.mock('@/lib/firestore/courses', () => ({
  updateCourse: vi.fn(),
}));

const baseCourse: Course = {
  id: 'course-1',
  code: 'CS 301',
  title: 'Data Structures',
  term: 'Fall 2026',
};

function renderCard(course: Course) {
  const initialState: Partial<AppState> = { courses: [course], scheduleItems: [] };
  return render(
    <ToastProvider>
      <AppStateProvider initialState={initialState as AppState}>
        <SectionSyncCard course={course} />
      </AppStateProvider>
    </ToastProvider>,
  );
}

describe('SectionSyncCard - not linked to a group yet', () => {
  beforeEach(() => {
    mockMembers = [];
    mockCheckpoints = [];
    mockConfirmations = [];
  });

  it('shows the create/join actions when the course has no groupCode', () => {
    renderCard(baseCourse);
    expect(screen.getByRole('button', { name: 'Create a group' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Join with a code' })).toBeDefined();
  });

  it('reveals the create form, with real name and username options derived from the signed-in user', () => {
    renderCard(baseCourse);
    fireEvent.click(screen.getByRole('button', { name: 'Create a group' }));

    expect(screen.getByLabelText(/group name/i)).toBeDefined();
    expect(screen.getByText('Ada Student')).toBeDefined();
    expect(screen.getByText('student')).toBeDefined();
  });

  it('reveals the join form asking for an invite code', () => {
    renderCard(baseCourse);
    fireEvent.click(screen.getByRole('button', { name: 'Join with a code' }));
    expect(screen.getByLabelText(/invite code/i)).toBeDefined();
  });
});

describe('SectionSyncCard - linked to a group', () => {
  const linkedCourse: Course = { ...baseCourse, groupCode: 'AB3DEFGH' };

  beforeEach(() => {
    mockMembers = [
      { uid: 'user-1', displayName: 'Ada Student', showRealName: true, joinedAt: '2026-09-24' },
      { uid: 'user-2', displayName: 'bsmith', showRealName: false, joinedAt: '2026-09-24' },
    ];
    mockCheckpoints = [
      { id: 'cp-1', label: 'Midterm 1', createdBy: 'user-1', createdAt: '2026-09-24' },
    ];
    mockConfirmations = [
      {
        id: 'cp-1_user-1',
        checkpointId: 'cp-1',
        uid: 'user-1',
        displayName: 'Ada Student',
        date: '2026-10-14',
        confirmedAt: '2026-09-24',
      },
      {
        id: 'cp-1_user-2',
        checkpointId: 'cp-1',
        uid: 'user-2',
        displayName: 'bsmith',
        date: '2026-10-14',
        confirmedAt: '2026-09-24',
      },
    ];
  });

  it('shows the formatted invite code and member count', () => {
    renderCard(linkedCourse);
    expect(screen.getByText(/2 members/)).toBeDefined();
    expect(screen.getByText('AB3D-EFGH')).toBeDefined();
  });

  it('shows the member roster with each member displayed by their own name preference', () => {
    renderCard(linkedCourse);
    expect(screen.getByText('Ada Student')).toBeDefined();
    expect(screen.getByText('bsmith')).toBeDefined();
  });

  it('shows a checkpoint with its confirmation tally', () => {
    renderCard(linkedCourse);
    expect(screen.getByText('Midterm 1')).toBeDefined();
    expect(screen.getByText('2 confirmed 2026-10-14')).toBeDefined();
  });

  it('shows the empty state when the group has no checkpoints yet', () => {
    mockCheckpoints = [];
    mockConfirmations = [];
    renderCard(linkedCourse);
    expect(screen.getByText('No checkpoints yet')).toBeDefined();
  });
});
