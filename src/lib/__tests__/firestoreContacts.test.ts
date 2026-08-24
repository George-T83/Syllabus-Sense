import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Contact } from '@/types/schedule';

const setDocMock = vi.fn();
const deleteDocMock = vi.fn();
const batchSetMock = vi.fn();
const batchCommitMock = vi.fn();

vi.mock('@/lib/firebase/client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.join('/')),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  writeBatch: vi.fn(() => ({
    set: batchSetMock,
    commit: batchCommitMock,
  })),
}));

import {
  createContact,
  createContacts,
  updateContact,
  updateCourseContactsTerm,
  deleteContact,
} from '@/lib/firestore/contacts';

const contact1: Contact = {
  id: 'ct1',
  courseId: 'c1',
  role: 'professor',
  fullName: 'Dr. Ada Lovelace',
  term: 'Fall 2026',
  source: 'manual',
  approved: true,
};

const contact2: Contact = {
  id: 'ct2',
  courseId: 'c1',
  role: 'ta',
  fullName: 'Charles Babbage',
  term: 'Fall 2026',
  source: 'manual',
  approved: true,
};

const otherContact: Contact = {
  id: 'ct3',
  courseId: 'c2',
  role: 'professor',
  fullName: 'Grace Hopper',
  term: 'Fall 2026',
  source: 'manual',
  approved: true,
};

describe('Firestore contacts service', () => {
  beforeEach(() => {
    setDocMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
    batchSetMock.mockReset();
    batchCommitMock.mockReset().mockResolvedValue(undefined);
  });

  it('createContact dispatches optimistically and writes to Firestore', async () => {
    const dispatch = vi.fn();
    await createContact('u1', contact1, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_CONTACT', payload: contact1 });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('createContact rolls back on write failure', async () => {
    setDocMock.mockRejectedValueOnce(new Error('network error'));
    const dispatch = vi.fn();

    await expect(createContact('u1', contact1, dispatch)).rejects.toThrow('network error');

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'ADD_CONTACT', payload: contact1 });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'REMOVE_CONTACT', payload: contact1.id });
  });

  it('createContacts batch-writes multiple contacts', async () => {
    const dispatch = vi.fn();
    await createContacts('u1', [contact1, contact2], dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_CONTACTS', payload: [contact1, contact2] });
    expect(batchSetMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('createContacts rolls back all added contacts on batch failure', async () => {
    batchCommitMock.mockRejectedValueOnce(new Error('batch denied'));
    const dispatch = vi.fn();

    await expect(createContacts('u1', [contact1, contact2], dispatch)).rejects.toThrow(
      'batch denied',
    );

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_CONTACT', payload: contact1.id });
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_CONTACT', payload: contact2.id });
  });

  it('updateContact updates state and persists changes', async () => {
    const dispatch = vi.fn();
    const updated = { ...contact1, officeHours: 'Mon 2-4pm' };

    await updateContact('u1', contact1, updated, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_CONTACT', payload: updated });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('updateCourseContactsTerm cascades term changes to course-affiliated contacts', async () => {
    const dispatch = vi.fn();
    const contacts = [contact1, contact2, otherContact];

    await updateCourseContactsTerm('u1', 'c1', 'Spring 2027', contacts, dispatch);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_CONTACT',
      payload: expect.objectContaining({ id: 'ct1', term: 'Spring 2027' }),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_CONTACT',
      payload: expect.objectContaining({ id: 'ct2', term: 'Spring 2027' }),
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: 'UPDATE_CONTACT',
      payload: expect.objectContaining({ id: 'ct3' }),
    });
    expect(batchSetMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('updateCourseContactsTerm clears term when newTerm is undefined', async () => {
    const dispatch = vi.fn();
    const contacts = [contact1];

    await updateCourseContactsTerm('u1', 'c1', undefined, contacts, dispatch);

    const callPayload = dispatch.mock.calls[0][0].payload;
    expect(callPayload.id).toBe('ct1');
    expect(callPayload.term).toBeUndefined();
  });

  it('updateCourseContactsTerm rolls back on failure', async () => {
    batchCommitMock.mockRejectedValueOnce(new Error('write failed'));
    const dispatch = vi.fn();
    const contacts = [contact1, contact2];

    await expect(
      updateCourseContactsTerm('u1', 'c1', 'Spring 2027', contacts, dispatch),
    ).rejects.toThrow('write failed');

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_CONTACT', payload: contact1 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_CONTACT', payload: contact2 });
  });

  it('deleteContact dispatches remove and deletes from Firestore', async () => {
    const dispatch = vi.fn();
    await deleteContact('u1', contact1, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_CONTACT', payload: contact1.id });
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
  });
});
