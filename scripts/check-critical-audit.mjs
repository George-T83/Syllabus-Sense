#!/usr/bin/env node
/**
 * CI gate: fails only on a critical `npm audit` finding that isn't already
 * tracked in scripts/acceptedCriticalVulnerabilities.json. A known, dated,
 * reasoned exception doesn't reset the gate to "anything goes" - a
 * genuinely new critical (a different package, or the same package once a
 * fix becomes available and isn't taken) still fails the build. See that
 * JSON file for what's currently accepted and why.
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

const { tracked, newCriticals } = partitionCriticals(auditJson.vulnerabilities, allowlist);

if (tracked.length > 0) {
  console.log(
    'Known, tracked critical findings (not blocking - see scripts/acceptedCriticalVulnerabilities.json):',
  );
  for (const [name] of tracked) {
    const entry = allowlist.find((e) => e.package === name);
    console.log(`  - ${name}: ${entry.reason}`);
  }
}

if (newCriticals.length > 0) {
  console.error('\nNEW critical vulnerabilities not in the accepted list:');
  for (const [name, v] of newCriticals) {
    console.error(`  - ${name} (${v.range || 'unknown range'})`);
  }
  console.error(
    '\nEither fix it, or if it genuinely has no available fix yet, add it to scripts/acceptedCriticalVulnerabilities.json with a dated reason.',
  );
  process.exit(1);
}

console.log(
  `\nNo new critical vulnerabilities (${tracked.length + newCriticals.length} critical total, ${tracked.length} already tracked).`,
);
