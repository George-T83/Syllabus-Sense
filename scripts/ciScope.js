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

module.exports = { isDocsOnly, isNonCodePath };
