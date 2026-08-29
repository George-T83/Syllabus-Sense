import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Contact } from '@/types/schedule';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * Same optimistic-dispatch-then-write, rollback-on-failure pattern as
 * lib/firestore/courses.ts, so a contact appears instantly and never drifts
 * from what's actually persisted.
 */
export async function createContact(
  userId: string,
  contact: Contact,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_CONTACT', payload: contact });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'contacts', contact.id), contact);
  } catch (err) {
    dispatch({ type: 'REMOVE_CONTACT', payload: contact.id });
    throw err;
  }
}

/**
 * Writes several contacts extracted from one syllabus in a single atomic
 * batch - used by the autofill-confirm flow so a partial network failure
 * can't leave e.g. the professor saved but the TA missing.
 */
export async function createContacts(
  userId: string,
  contacts: Contact[],
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  if (contacts.length === 0) return;
  dispatch({ type: 'ADD_CONTACTS', payload: contacts });
  try {
    const database = requireDb();
    const batch = writeBatch(database);
    contacts.forEach((contact) => {
      batch.set(doc(database, 'users', userId, 'contacts', contact.id), contact);
    });
    await batch.commit();
  } catch (err) {
    contacts.forEach((contact) => dispatch({ type: 'REMOVE_CONTACT', payload: contact.id }));
    throw err;
  }
}

export async function updateContact(
  userId: string,
  previousContact: Contact,
  updatedContact: Contact,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'UPDATE_CONTACT', payload: updatedContact });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'contacts', updatedContact.id), updatedContact);
  } catch (err) {
    dispatch({ type: 'UPDATE_CONTACT', payload: previousContact });
    throw err;
  }
}

/**
 * Cascades a course term change to all contacts associated with that course,
 * updating local state optimistically and persisting via an atomic Firestore writeBatch.
 */
export async function updateCourseContactsTerm(
  userId: string,
  courseId: string,
  newTerm: string | undefined,
  contacts: Contact[],
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  const affected = contacts.filter((c) => c.courseId === courseId);
  if (affected.length === 0) return;

  const previousContacts = [...affected];
  const updatedContacts = affected.map((c) => {
    const updated = { ...c };
    if (newTerm) {
      updated.term = newTerm;
    } else {
      delete updated.term;
    }
    return updated;
  });

  updatedContacts.forEach((c) => dispatch({ type: 'UPDATE_CONTACT', payload: c }));
  try {
    const database = requireDb();
    const batch = writeBatch(database);
    updatedContacts.forEach((c) => {
      batch.set(doc(database, 'users', userId, 'contacts', c.id), c);
    });
    await batch.commit();
  } catch (err) {
    previousContacts.forEach((c) => dispatch({ type: 'UPDATE_CONTACT', payload: c }));
    throw err;
  }
}

export async function deleteContact(
  userId: string,
  contact: Contact,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'REMOVE_CONTACT', payload: contact.id });
  try {
    await deleteDoc(doc(requireDb(), 'users', userId, 'contacts', contact.id));
  } catch (err) {
    dispatch({ type: 'ADD_CONTACT', payload: contact });
    throw err;
  }
}
