#!/usr/bin/env node
/**
 * CI helper: prints `code=true|false` and `audit=true|false` (and appends them
 * to $GITHUB_OUTPUT when set) for the checked-out pull-request merge commit.
 * `code=false` means the PR changes only prose; `audit=false` means it touches
 * nothing the dependency audit reads. See scripts/ciScope.js.
 *
 * Fails safe: on anything but a pull-request merge commit, or if git cannot
 * produce the file list, it says `code=true` so the full pipeline runs.
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isDocsOnly, auditNeeded } from './ciScope.js';

function changedFiles() {
  // actions/checkout on a pull_request event checks out the merge of the PR
  // into its base: parent 1 is the base tip, so the diff against it is exactly
  // what merging this PR would change.
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') return null;
  const out = execSync('git diff --name-only HEAD^1 HEAD', { encoding: 'utf8' });
  return out.split('\n');
}

let code = true;
let audit = true;
try {
  const files = changedFiles();
  if (files) {
    code = !isDocsOnly(files);
    audit = auditNeeded(files);
    console.log(
      `${files.filter(Boolean).length} changed file(s); docs-only: ${!code}; audit needed: ${audit}`,
    );
  } else {
    console.log('Not a pull request: running everything.');
  }
} catch (err) {
  console.log(`Could not list changed files (${err.message}): running everything.`);
}

const lines = [`code=${code}`, `audit=${audit}`];
console.log(lines.join('\n'));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
