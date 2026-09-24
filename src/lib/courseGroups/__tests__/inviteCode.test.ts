import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateInviteCode,
  formatInviteCodeForDisplay,
  normalizeInviteCodeInput,
} from '../inviteCode';

describe('generateInviteCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates an 8-character code from the expected alphabet', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  });

  it('excludes visually ambiguous characters', () => {
    const codes = Array.from({ length: 200 }, () => generateInviteCode()).join('');
    expect(codes).not.toMatch(/[0O1IL]/);
  });

  it('generates different codes across calls (not a fixed constant)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('formatInviteCodeForDisplay', () => {
  it('splits an 8-character code into two hyphenated groups of 4', () => {
    expect(formatInviteCodeForDisplay('AB3DEFGH')).toBe('AB3D-EFGH');
  });

  it('returns a non-standard-length string unchanged', () => {
    expect(formatInviteCodeForDisplay('SHORT')).toBe('SHORT');
  });
});

describe('normalizeInviteCodeInput', () => {
  it('strips whitespace and hyphens and uppercases the result', () => {
    expect(normalizeInviteCodeInput(' ab3d-efgh ')).toBe('AB3DEFGH');
  });

  it('is the inverse of formatInviteCodeForDisplay for a valid code', () => {
    const code = generateInviteCode();
    expect(normalizeInviteCodeInput(formatInviteCodeForDisplay(code))).toBe(code);
  });
});
