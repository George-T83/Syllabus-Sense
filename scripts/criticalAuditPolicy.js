/**
 * Pure policy logic for scripts/check-critical-audit.mjs, split out so it's
 * testable without shelling out to `npm audit` - see that script for the
 * actual CLI wrapper and scripts/acceptedCriticalVulnerabilities.json for
 * what's currently tracked and why.
 *
 * A waiver is a deliberate, temporary exception, so it must carry an
 * `expires` date (YYYY-MM-DD, valid through the end of that UTC day) no more
 * than MAX_WAIVER_DAYS after `trackedSince`. A waiver that is past its date,
 * has no date, or has an unreasonable one stops excusing its package, so the
 * build fails until someone either fixes the vulnerability or makes the
 * decision again on purpose. Nothing is waived forever by default.
 */

const MAX_WAIVER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses YYYY-MM-DD as a UTC midnight, or null if it is not a real date. */
function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * @typedef {{package: string, reason: string, trackedSince: string, expires?: string}} Waiver
 */

/**
 * @param {Waiver} entry
 * @param {Date} now
 * @returns {{active: boolean, problem?: string}}
 */
function checkWaiver(entry, now) {
  const expires = parseDay(entry.expires);
  if (expires === null)
    return { active: false, problem: 'has no valid `expires` date (YYYY-MM-DD)' };

  const since = parseDay(entry.trackedSince);
  if (since !== null && expires - since > MAX_WAIVER_DAYS * DAY_MS) {
    return {
      active: false,
      problem: `expires more than ${MAX_WAIVER_DAYS} days after it was first tracked`,
    };
  }
  // Valid through the end of the day it names.
  if (now.getTime() >= expires + DAY_MS) {
    return { active: false, problem: `expired on ${entry.expires}` };
  }
  return { active: true };
}

/**
 * @param {Record<string, {severity: string, range?: string}>} vulnerabilities - npm audit --json's `.vulnerabilities` map
 * @param {Waiver[]} allowlist
 * @param {Date} [now]
 * @returns {{
 *   tracked: Array<[string, object]>,
 *   newCriticals: Array<[string, object]>,
 *   expired: Array<{entry: Waiver, problem: string, vulnerability: object}>,
 *   staleEntries: Waiver[],
 * }} `tracked` are criticals excused by a live waiver; `newCriticals` have no
 * waiver; `expired` are criticals whose waiver is no longer valid;
 * `staleEntries` are waivers that no longer match any critical and can go.
 */
function partitionCriticals(vulnerabilities, allowlist, now = new Date()) {
  const criticals = Object.entries(vulnerabilities || {}).filter(
    ([, v]) => v.severity === 'critical',
  );
  const byPackage = new Map(allowlist.map((e) => [e.package, e]));

  const tracked = [];
  const newCriticals = [];
  const expired = [];
  for (const [name, v] of criticals) {
    const entry = byPackage.get(name);
    if (!entry) {
      newCriticals.push([name, v]);
      continue;
    }
    const verdict = checkWaiver(entry, now);
    if (verdict.active) tracked.push([name, v]);
    else expired.push({ entry, problem: verdict.problem, vulnerability: v });
  }

  const criticalNames = new Set(criticals.map(([name]) => name));
  const staleEntries = allowlist.filter((e) => !criticalNames.has(e.package));
  return { tracked, newCriticals, expired, staleEntries };
}

module.exports = { partitionCriticals, checkWaiver, MAX_WAIVER_DAYS };
