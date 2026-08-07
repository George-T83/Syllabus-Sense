import { vi, describe, it, expect } from 'vitest';

// Use vi.hoisted to ensure these process.env variables are defined before imports are executed
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-auth-domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project-id';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mock-storage-bucket';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'mock-messaging-sender-id';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID =
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'mock-app-id';
});

// Mock the modular Firebase client modules to prevent network requests and configuration check failures
vi.mock('firebase/app', () => {
  return {
    initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  };
});

vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(() => ({})),
    connectAuthEmulator: vi.fn(),
  };
});

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    connectFirestoreEmulator: vi.fn(),
  };
});

vi.mock('firebase/storage', () => {
  return {
    getStorage: vi.fn(() => ({})),
    connectStorageEmulator: vi.fn(),
  };
});

import { app, auth, db, storage, getFirestoreDatabaseId } from '../firebase/client';

describe('Firebase Client SDK Module Initialization', () => {
  it('correctly exports the mock-initialized app, auth, db, and storage instances', () => {
    expect(app).toBeDefined();
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storage).toBeDefined();
  });
});

describe('getFirestoreDatabaseId helper', () => {
  it('returns undefined if value is empty or undefined', () => {
    expect(getFirestoreDatabaseId()).toBeUndefined();
    expect(getFirestoreDatabaseId('')).toBeUndefined();
  });

  it("returns undefined if value is '(default)'", () => {
    expect(getFirestoreDatabaseId('(default)')).toBeUndefined();
  });

  it('returns the database ID if it is any other string', () => {
    expect(getFirestoreDatabaseId('staging')).toBe('staging');
    expect(getFirestoreDatabaseId('production-db')).toBe('production-db');
  });
});
