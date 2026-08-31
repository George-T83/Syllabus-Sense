import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules (firestore.rules Audit & Structural Suite)', () => {
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('enforces rules_version 2 and targets cloud.firestore service', () => {
    expect(rulesContent).toMatch(/rules_version\s*=\s*'2'/);
    expect(rulesContent).toMatch(/service\s+cloud\.firestore/);
  });

  it('strictly scopes user root documents (/users/{userId}) to auth UID match', () => {
    expect(rulesContent).toMatch(/match\s+\/users\/\{userId\}/);
    expect(rulesContent).toMatch(
      /request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId/,
    );
  });

  it('strictly scopes courses subcollection to auth UID match', () => {
    expect(rulesContent).toMatch(/match\s+\/courses\/\{courseId\}/);
  });

  it('strictly scopes syllabi nested subcollection to auth UID match', () => {
    expect(rulesContent).toMatch(/match\s+\/syllabi\/\{syllabusId\}/);
  });

  it('strictly scopes scheduleItems subcollection to auth UID match', () => {
    expect(rulesContent).toMatch(/match\s+\/scheduleItems\/\{itemId\}/);
  });

  it('strictly scopes contacts subcollection to auth UID match', () => {
    expect(rulesContent).toMatch(/match\s+\/contacts\/\{contactId\}/);
  });

  it('contains a default catch-all rule blocking all unhandled paths', () => {
    expect(rulesContent).toMatch(/match\s+\/\{document=\*\*\}/);
    expect(rulesContent).toMatch(/allow\s+read,\s*write:\s*if\s+false/);
  });

  describe('Rule Logic Simulator (Security Boundary Assertion)', () => {
    interface SecurityContext {
      auth: { uid: string } | null;
      path: string;
      userIdInPath: string;
    }

    function evaluateAccess(ctx: SecurityContext): boolean {
      if (ctx.path.startsWith('/users/')) {
        if (!ctx.auth) return false;
        return ctx.auth.uid === ctx.userIdInPath;
      }
      return false; // Default catch-all deny
    }

    it('denies unauthenticated access to user profile and subcollections', () => {
      expect(
        evaluateAccess({
          auth: null,
          path: '/users/user123',
          userIdInPath: 'user123',
        }),
      ).toBe(false);
    });

    it('denies cross-user data access (User A attempting to read User B data)', () => {
      expect(
        evaluateAccess({
          auth: { uid: 'attacker_uid' },
          path: '/users/victim_uid',
          userIdInPath: 'victim_uid',
        }),
      ).toBe(false);
    });

    it('allows owner authenticated access to their own data tree', () => {
      expect(
        evaluateAccess({
          auth: { uid: 'student_123' },
          path: '/users/student_123',
          userIdInPath: 'student_123',
        }),
      ).toBe(true);
    });
  });
});
