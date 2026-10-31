/**
 * Decides whether a pull request changes anything the CI jobs can actually
 * react to. A change that touches only prose (Markdown, docs/, the licence,
 * the issue/PR templates) cannot alter lint, the build, a unit test, the
 * Firestore rules or the browser smoke run, so those heavy jobs are skipped
 * for it - while the required "Lint, Build, and Test" check still reports,
 * because the job itself always runs (it still does the commit-attribution
 * check and says what it skipped). This is deliberately a short allowlist of
 * "cannot matter" paths rather than a list of "code" paths: anything not named
 * here, including every workflow file, runs the full pipeline.
 */

const NON_CODE = [
  /\.md$/i,
  /^docs\//,
  /^LICENSE(\.[a-z]+)?$/i,
  /^\.github\/ISSUE_TEMPLATE\//,
  /^\.github\/pull_request_template\.md$/i,
];

function isNonCodePath(file) {
  return NON_CODE.some((re) => re.test(file));
}

/**
 * True only when there is at least one changed file and every one of them is
 * a non-code path. An empty list means "could not tell", which must run CI.
 */
function isDocsOnly(files) {
  const list = files.map((f) => f.trim()).filter(Boolean);
  return list.length > 0 && list.every(isNonCodePath);
}

/**
 * The critical-dependency audit reads the lockfile and the advisory database,
 * so a pull request can only change its outcome by touching the dependencies,
 * the waiver list, the audit script itself, or the pipeline. Everything else
 * is covered by the run on main and the scheduled audit (see
 * .github/workflows/dependency-audit.yml), which also catch an advisory
 * published after a dependency was added. An empty list means "could not
 * tell", which audits.
 */
const AUDIT_INPUTS = [
  /^package(-lock)?\.json$/,
  /^scripts\/(check-critical-audit\.mjs|criticalAuditPolicy\.js|acceptedCriticalVulnerabilities\.json)$/,
  /^\.github\/workflows\//,
];

function auditNeeded(files) {
  const list = files.map((f) => f.trim()).filter(Boolean);
  return list.length === 0 || list.some((f) => AUDIT_INPUTS.some((re) => re.test(f)));
}

module.exports = { isDocsOnly, isNonCodePath, auditNeeded };
