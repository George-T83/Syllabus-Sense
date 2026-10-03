#!/usr/bin/env node
/**
 * CI gate: fails on a critical `npm audit` finding unless it is covered by a
 * live waiver in scripts/acceptedCriticalVulnerabilities.json. A waiver is a
 * known, reasoned, *temporary* exception: each entry needs a `package`, a
 * `reason`, `trackedSince` and an `expires` date (YYYY-MM-DD, at most 90 days
 * after `trackedSince`). Once it expires the build fails again until the
 * vulnerability is fixed or the decision is renewed on purpose. A genuinely
 * new critical (a different package) fails immediately. The file is an empty
 * list when nothing is waived, which is the goal.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partitionCriticals } from './criticalAuditPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowlist = JSON.parse(
  readFileSync(path.join(__dirname, 'acceptedCriticalVulnerabilities.json'), 'utf8'),
);

let auditJson;
try {
  const out = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 });
  auditJson = JSON.parse(out);
} catch (err) {
  // npm audit exits non-zero whenever it finds anything - the JSON report
  // is still on stdout, so only a genuinely missing stdout (e.g. npm itself
  // crashed) should propagate as a real error.
  if (!err.stdout) throw err;
  auditJson = JSON.parse(err.stdout);
}

const { tracked, newCriticals, expired, staleEntries } = partitionCriticals(
  auditJson.vulnerabilities,
  allowlist,
);

if (tracked.length > 0) {
  console.log(
    'Known, tracked critical findings (not blocking - see scripts/acceptedCriticalVulnerabilities.json):',
  );
  for (const [name] of tracked) {
    const entry = allowlist.find((e) => e.package === name);
    console.log(`  - ${name}: ${entry.reason} (waiver expires ${entry.expires})`);
  }
}

if (staleEntries.length > 0) {
  console.log('\nWaivers that no longer match any critical finding - delete them:');
  for (const e of staleEntries) console.log(`  - ${e.package}`);
}

if (expired.length > 0) {
  console.error('\nCritical vulnerabilities whose waiver is no longer valid:');
  for (const { entry, problem, vulnerability } of expired) {
    console.error(
      `  - ${entry.package} (${vulnerability.range || 'unknown range'}): waiver ${problem}`,
    );
  }
  console.error(
    '\nFix the vulnerability, or renew the waiver on purpose with a new `expires` date and reason.',
  );
}

if (newCriticals.length > 0) {
  console.error('\nNEW critical vulnerabilities not in the accepted list:');
  for (const [name, v] of newCriticals) {
    console.error(`  - ${name} (${v.range || 'unknown range'})`);
  }
  console.error(
    '\nEither fix it, or if it genuinely has no available fix yet, add it to scripts/acceptedCriticalVulnerabilities.json with a reason and an `expires` date.',
  );
}

if (newCriticals.length > 0 || expired.length > 0) process.exit(1);

console.log(
  `\nNo unwaived critical vulnerabilities (${tracked.length} critical total, ${tracked.length} covered by a live waiver).`,
);
