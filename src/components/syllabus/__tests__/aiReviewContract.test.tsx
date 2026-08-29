import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SyllabusAutofillModal } from '@/components/syllabus/SyllabusAutofillModal';
import { AppStateProvider } from '@/context/AppStateContext';
import type { SyllabusExtractionResult } from '@/types/extraction';

const mockCreateCourseWithScheduleItems = vi.fn();
const mockCreateContacts = vi.fn();
const mockUpdateContact = vi.fn();
const mockPush = vi.fn();

vi.mock('@/lib/firestore/courses', () => ({
  createCourseWithScheduleItems: (...args: unknown[]) => mockCreateCourseWithScheduleItems(...args),
}));

vi.mock('@/lib/firestore/contacts', () => ({
  createContacts: (...args: unknown[]) => mockCreateContacts(...args),
  updateContact: (...args: unknown[]) => mockUpdateContact(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

const mockUser = {
  uid: 'user-contract-123',
  getIdToken: vi.fn().mockResolvedValue('mock-token-abc'),
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn().mockResolvedValue({ ref: {} }),
  getDownloadURL: vi.fn().mockResolvedValue('https://storage.mock/syllabus.pdf'),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.join('/')),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase/client', () => ({
  storage: {},
  db: {},
}));

const sampleExtractionResult: SyllabusExtractionResult = {
  course: {
    code: 'BIO 201',
    title: 'Cellular Biology',
    instructor: 'Dr. Rosalind Franklin',
    term: 'Fall 2026',
    modality: 'in-person',
    meetingTimes: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '11:15', location: 'Science Hall 101' },
    ],
    materials: ['Campbell Biology 12th Ed.'],
    skipDates: ['2026-10-12'],
    notes: 'Weekly lab attendance mandatory.',
    suggestedColor: 'emerald',
    suggestedFileName: 'BIO 201 - Fall 2026 Syllabus',
    suggestedIcon: 'flask',
    contacts: [
      {
        role: 'professor',
        fullName: 'Rosalind Franklin',
        title: 'Professor of Biology',
        howToAddress: 'Dr. Franklin',
        email: 'rfranklin@university.edu',
        officeHours: 'Tue/Thu 2-4 PM',
        officeLocation: 'Franklin Lab 304',
      },
    ],
    learningObjectives: [
      'Understand cellular respiration',
      'Perform DNA electrophoresis experiments',
    ],
  },
  scheduleItems: [
    {
      title: 'Lab Report 1',
      type: 'assignment',
      dueDate: '2026-09-15',
      dateConfidence: 'exact',
      gradeWeight: 10,
      gradeCategory: 'Labs',
      notes: 'Submit PDF to portal',
      highStakes: false,
    },
    {
      title: 'Midterm Exam',
      type: 'exam',
      dueDate: '2026-10-20',
      dateConfidence: 'exact',
      gradeWeight: 25,
      gradeCategory: 'Exams',
      notes: 'Covers units 1-4',
      highStakes: true,
    },
    {
      title: 'Unscheduled Reading Check',
      type: 'reading',
      dueDate: null,
      dateConfidence: 'unknown',
      gradeWeight: 5,
      gradeCategory: 'Participation',
      notes: 'Dates announced on LMS',
      highStakes: false,
    },
  ],
  unresolved: ['Reading Check has no date assigned in syllabus'],
};

function renderAutofillModal(props: { open: boolean; onClose: () => void }) {
  return render(
    <AppStateProvider
      initialState={{
        courses: [],
        scheduleItems: [],
        contacts: [],
      }}
    >
      <SyllabusAutofillModal {...props} />
    </AppStateProvider>,
  );
}

describe('AI Review Contract & Client-Memory Guarantee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCourseWithScheduleItems.mockResolvedValue(undefined);
    mockCreateContacts.mockResolvedValue(undefined);
    mockUpdateContact.mockResolvedValue(undefined);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: sampleExtractionResult }),
    } as Response);
  });

  it('CONTRACT: Keeps extracted syllabus data strictly in client memory without writing to Firestore during parse', async () => {
    const onClose = vi.fn();
    renderAutofillModal({ open: true, onClose });

    const file = new File(['%PDF-1.4 test syllabus'], 'bio201.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { files: [file] } });

    // Wait for parse step to transition to Review
    expect(await screen.findByDisplayValue('BIO 201')).toBeDefined();
    expect(screen.getByDisplayValue('Cellular Biology')).toBeDefined();

    // Verify ZERO calls to Firestore during review step
    expect(mockCreateCourseWithScheduleItems).not.toHaveBeenCalled();
    expect(mockCreateContacts).not.toHaveBeenCalled();
  });

  it('CONTRACT: Closing or canceling the modal discards in-memory draft with zero Firestore writes', async () => {
    const onClose = vi.fn();
    renderAutofillModal({ open: true, onClose });

    const file = new File(['%PDF-1.4 test syllabus'], 'bio201.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByDisplayValue('BIO 201');

    // Click Cancel / Close
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
    expect(mockCreateCourseWithScheduleItems).not.toHaveBeenCalled();
    expect(mockCreateContacts).not.toHaveBeenCalled();
  });

  it('CONTRACT: Unapproved or dateless schedule items are filtered out and NEVER persisted to Firestore', async () => {
    const onClose = vi.fn();
    renderAutofillModal({ open: true, onClose });

    const file = new File(['%PDF-1.4 test syllabus'], 'bio201.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByDisplayValue('BIO 201');

    // Reject "Lab Report 1" by clicking the first Reject button in schedule items
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' });
    expect(rejectButtons.length).toBeGreaterThan(0);
    fireEvent.click(rejectButtons[0]);

    // Click Add Course button
    const saveButton = screen.getByRole('button', { name: /Add Course & \d+ Task/i });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockCreateCourseWithScheduleItems).toHaveBeenCalledTimes(1));

    const [, , savedItems] = mockCreateCourseWithScheduleItems.mock.calls[0];
    const savedTitles = savedItems.map((it: { title: string }) => it.title);

    // Only Midterm Exam should be saved (Lab Report 1 was rejected, Reading Check had null dueDate)
    expect(savedTitles).toContain('Midterm Exam');
    expect(savedTitles).not.toContain('Lab Report 1');
    expect(savedTitles).not.toContain('Unscheduled Reading Check');
  });

  it('CONTRACT: Client edits to course metadata and learning objectives are reflected on confirm', async () => {
    const onClose = vi.fn();
    renderAutofillModal({ open: true, onClose });

    const file = new File(['%PDF-1.4 test syllabus'], 'bio201.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByDisplayValue('BIO 201');

    // Edit course title in review screen
    const titleInput = screen.getByDisplayValue('Cellular Biology');
    fireEvent.change(titleInput, { target: { value: 'Advanced Cellular Biology' } });

    // Confirm save
    const saveButton = screen.getByRole('button', { name: /Add Course & \d+ Task/i });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockCreateCourseWithScheduleItems).toHaveBeenCalledTimes(1));

    const [, savedCourse] = mockCreateCourseWithScheduleItems.mock.calls[0];
    expect(savedCourse.title).toBe('Advanced Cellular Biology');
    expect(savedCourse.learningObjectives).toEqual([
      'Understand cellular respiration',
      'Perform DNA electrophoresis experiments',
    ]);
  });

  it('CONTRACT: Contact field unchecking prevents unapproved contact fields from persisting', async () => {
    const onClose = vi.fn();
    renderAutofillModal({ open: true, onClose });

    const file = new File(['%PDF-1.4 test syllabus'], 'bio201.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByDisplayValue('BIO 201');

    // Uncheck the email field for the professor contact
    const emailCheckbox = screen.getByRole('checkbox', {
      name: /Email: rfranklin@university.edu/i,
    });
    fireEvent.click(emailCheckbox);

    // Confirm save
    const saveButton = screen.getByRole('button', { name: /Add Course & \d+ Task/i });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockCreateCourseWithScheduleItems).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockCreateContacts).toHaveBeenCalledTimes(1));

    const [, createdContacts] = mockCreateContacts.mock.calls[0];
    expect(createdContacts[0].fullName).toBe('Rosalind Franklin');
    // email was unchecked, so it should not be populated on the contact
    expect(createdContacts[0].email).toBeUndefined();
    expect(createdContacts[0].fieldApprovals?.email).toBe(false);
  });
});
