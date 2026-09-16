import { describe, it, expect } from 'vitest';
import { partitionCriticals } from '../criticalAuditPolicy.js';

describe('partitionCriticals', () => {
  const allowlist = [{ package: 'next', reason: 'known', trackedSince: '2026-09-16' }];

  it('treats an allowlisted critical as tracked, not new', () => {
    const { tracked, newCriticals } = partitionCriticals(
      { next: { severity: 'critical', range: '14.0.0' } },
      allowlist,
    );
    expect(tracked).toHaveLength(1);
    expect(newCriticals).toHaveLength(0);
  });

  it('flags a critical in a package not on the allowlist as new', () => {
    const { tracked, newCriticals } = partitionCriticals(
      { 'some-other-pkg': { severity: 'critical', range: '1.0.0' } },
      allowlist,
    );
    expect(newCriticals).toHaveLength(1);
    expect(tracked).toHaveLength(0);
  });

  it('ignores non-critical severities entirely, even for an allowlisted package', () => {
    const { tracked, newCriticals } = partitionCriticals(
      { next: { severity: 'moderate', range: '1.0.0' }, qs: { severity: 'high', range: '1.0.0' } },
      allowlist,
    );
    expect(tracked).toHaveLength(0);
    expect(newCriticals).toHaveLength(0);
  });

  it('handles an empty vulnerabilities map', () => {
    const { tracked, newCriticals } = partitionCriticals({}, allowlist);
    expect(tracked).toHaveLength(0);
    expect(newCriticals).toHaveLength(0);
  });

  it('handles a mix of tracked and new criticals in the same run', () => {
    const { tracked, newCriticals } = partitionCriticals(
      {
        next: { severity: 'critical', range: '14.0.0' },
        'brand-new-pkg': { severity: 'critical', range: '2.0.0' },
      },
      allowlist,
    );
    expect(tracked.map(([name]) => name)).toEqual(['next']);
    expect(newCriticals.map(([name]) => name)).toEqual(['brand-new-pkg']);
  });
});
