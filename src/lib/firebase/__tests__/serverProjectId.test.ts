import { describe, it, expect, afterEach, vi } from 'vitest';
import { getServerProjectId } from '../serverProjectId';

describe('getServerProjectId', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the admin project ID when it is set', () => {
    vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', 'admin-project');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'public-project');
    expect(getServerProjectId()).toBe('admin-project');
  });

  it('falls back to the public project ID when the admin one is missing or empty', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'public-project');
    vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', '');
    expect(getServerProjectId()).toBe('public-project');
  });

  it('is undefined when neither is set', () => {
    vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    expect(getServerProjectId()).toBeUndefined();
  });
});
