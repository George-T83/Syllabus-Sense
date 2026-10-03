import { describe, it, expect } from 'vitest';
import { partitionCriticals, checkWaiver, MAX_WAIVER_DAYS } from '../criticalAuditPolicy.js';

const NOW = new Date('2026-10-02T12:00:00Z');
const waiver = (over: Record<string, unknown> = {}) => ({
  package: 'next',
  reason: 'known',
  trackedSince: '2026-09-16',
  expires: '2026-12-01',
  ...over,
});

describe('partitionCriticals', () => {
  const allowlist = [waiver()];

  it('treats a critical with a live waiver as tracked, not new', () => {
    const { tracked, newCriticals, expired } = partitionCriticals(
      { next: { severity: 'critical', range: '14.0.0' } },
      allowlist,
      NOW,
    );
    expect(tracked).toHaveLength(1);
    expect(newCriticals).toHaveLength(0);
    expect(expired).toHaveLength(0);
  });

  it('flags a critical in a package that has no waiver as new', () => {
    const { tracked, newCriticals } = partitionCriticals(
      { 'some-other-pkg': { severity: 'critical', range: '1.0.0' } },
      allowlist,
      NOW,
    );
    expect(newCriticals).toHaveLength(1);
    expect(tracked).toHaveLength(0);
  });

  it('ignores non-critical severities entirely, even for a waived package', () => {
    const { tracked, newCriticals, expired } = partitionCriticals(
      { next: { severity: 'moderate', range: '1.0.0' }, qs: { severity: 'high', range: '1.0.0' } },
      allowlist,
      NOW,
    );
    expect(tracked).toHaveLength(0);
    expect(newCriticals).toHaveLength(0);
    expect(expired).toHaveLength(0);
  });

  it('handles an empty vulnerabilities map and an empty allowlist', () => {
    expect(partitionCriticals({}, allowlist, NOW)).toMatchObject({ tracked: [], newCriticals: [] });
    const { newCriticals } = partitionCriticals({ next: { severity: 'critical' } }, [], NOW);
    expect(newCriticals.map(([n]) => n)).toEqual(['next']);
  });

  it('handles a mix of tracked and new criticals in the same run', () => {
    const { tracked, newCriticals } = partitionCriticals(
      {
        next: { severity: 'critical', range: '14.0.0' },
        'brand-new-pkg': { severity: 'critical', range: '2.0.0' },
      },
      allowlist,
      NOW,
    );
    expect(tracked.map(([name]) => name)).toEqual(['next']);
    expect(newCriticals.map(([name]) => name)).toEqual(['brand-new-pkg']);
  });
});

describe('waiver expiry', () => {
  it('stops excusing a critical once the waiver has expired', () => {
    const { tracked, expired } = partitionCriticals(
      { next: { severity: 'critical', range: '14.0.0' } },
      [waiver({ expires: '2026-10-01' })],
      NOW,
    );
    expect(tracked).toHaveLength(0);
    expect(expired).toHaveLength(1);
    expect(expired[0].problem).toBe('expired on 2026-10-01');
  });

  it('is still valid through the end of the expiry day (UTC)', () => {
    const entry = waiver({ expires: '2026-10-02' });
    expect(checkWaiver(entry, new Date('2026-10-02T23:59:59Z')).active).toBe(true);
    expect(checkWaiver(entry, new Date('2026-10-03T00:00:00Z')).active).toBe(false);
  });

  it.each([undefined, '', 'soon', '2026-13-45', '10/02/2026'])(
    'fails closed when the expiry is %j',
    (expires) => {
      const verdict = checkWaiver(waiver({ expires }), NOW);
      expect(verdict.active).toBe(false);
      expect(verdict.problem).toMatch(/no valid `expires` date/);
    },
  );

  it(`rejects a waiver that runs more than ${MAX_WAIVER_DAYS} days from when it was first tracked`, () => {
    const verdict = checkWaiver(waiver({ trackedSince: '2026-09-16', expires: '2099-01-01' }), NOW);
    expect(verdict.active).toBe(false);
    expect(verdict.problem).toMatch(/more than 90 days/);
  });

  it('accepts a waiver of exactly the maximum length', () => {
    // 2026-09-16 + 90 days = 2026-12-15
    expect(checkWaiver(waiver({ expires: '2026-12-15' }), NOW).active).toBe(true);
    expect(checkWaiver(waiver({ expires: '2026-12-16' }), NOW).active).toBe(false);
  });
});

describe('stale waivers', () => {
  it('lists waivers that no longer match any critical finding', () => {
    const { staleEntries } = partitionCriticals(
      { other: { severity: 'critical' } },
      [waiver(), waiver({ package: 'other' })],
      NOW,
    );
    expect(staleEntries.map((e: { package: string }) => e.package)).toEqual(['next']);
  });

  it('reports every waiver as stale once nothing is critical', () => {
    const { staleEntries } = partitionCriticals({}, [waiver()], NOW);
    expect(staleEntries).toHaveLength(1);
  });
});
