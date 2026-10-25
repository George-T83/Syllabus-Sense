import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../rateLimit';

describe('createRateLimiter', () => {
  it('allows up to the limit, then refuses with a retry time', () => {
    const check = createRateLimiter(3, 60_000);
    expect(check('u1', 0).allowed).toBe(true);
    expect(check('u1', 1_000).allowed).toBe(true);
    expect(check('u1', 2_000).allowed).toBe(true);
    const blocked = check('u1', 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(57);
  });

  it('counts each key separately', () => {
    const check = createRateLimiter(1, 60_000);
    expect(check('a', 0).allowed).toBe(true);
    expect(check('b', 0).allowed).toBe(true);
    expect(check('a', 1).allowed).toBe(false);
  });

  it('lets calls through again once the window has passed', () => {
    const check = createRateLimiter(1, 60_000);
    expect(check('a', 0).allowed).toBe(true);
    expect(check('a', 59_999).allowed).toBe(false);
    expect(check('a', 60_000).allowed).toBe(true);
  });

  it('does not grow without bound', () => {
    const check = createRateLimiter(1, 60_000, 10);
    for (let i = 0; i < 50; i++) check(`k${i}`, i);
    // The oldest keys were forgotten, so k0 is fresh again.
    expect(check('k0', 100).allowed).toBe(true);
  });
});
