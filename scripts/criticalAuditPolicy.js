/**
 * Pure policy logic for scripts/check-critical-audit.mjs, split out so it's
 * testable without shelling out to `npm audit` - see that script for the
 * actual CLI wrapper and scripts/acceptedCriticalVulnerabilities.json for
 * what's currently tracked and why.
 */

/**
 * @param {Record<string, {severity: string, range?: string}>} vulnerabilities - npm audit --json's `.vulnerabilities` map
 * @param {Array<{package: string, reason: string, trackedSince: string}>} allowlist
 */
function partitionCriticals(vulnerabilities, allowlist) {
  const allowedNames = new Set(allowlist.map((e) => e.package));
  const criticals = Object.entries(vulnerabilities || {}).filter(
    ([, v]) => v.severity === 'critical',
  );
  const tracked = criticals.filter(([name]) => allowedNames.has(name));
  const newCriticals = criticals.filter(([name]) => !allowedNames.has(name));
  return { tracked, newCriticals };
}

module.exports = { partitionCriticals };
