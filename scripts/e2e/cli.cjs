const assert = require('node:assert/strict');
const { appendFileSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { candidateTarget, previousCompatibility, publishedTarget } = require('./targets.cjs');
const { snapshot } = require('./source.cjs');
const { runConsumer } = require('./consumer.cjs');

function prepare(
  {
    repository,
    candidateRepository,
    destination,
    kind,
    target,
    testRef,
    baselineVersion,
    projects,
    nodes,
  },
  operations = {}
) {
  const createCandidateTarget = operations.candidateTarget || candidateTarget;
  const createPublishedTarget = operations.publishedTarget || publishedTarget;
  const resolvePreviousCompatibility = operations.automaticCompatibility || previousCompatibility;
  const freezeSnapshot = operations.snapshot || snapshot;
  assert(['npm', 'candidate'].includes(kind), 'Target kind must be npm or candidate');
  assert(!existsSync(destination), 'Use a fresh bundle directory');
  mkdirSync(destination, { recursive: true });
  const selected =
    kind === 'npm'
      ? createPublishedTarget(repository, target, join(destination, 'packages'))
      : createCandidateTarget(candidateRepository, join(destination, 'packages'));
  const unitVersion = selected.packages.find((pkg) => pkg.name === '@suites/unit').version;
  const automatic =
    baselineVersion === 'previous'
      ? resolvePreviousCompatibility(repository, selected.packages)
      : undefined;
  const requestedBaseline =
    automatic?.baselineVersion || (baselineVersion === 'previous' ? undefined : baselineVersion);
  const baseline = requestedBaseline
    ? createPublishedTarget(repository, requestedBaseline, join(destination, 'packages'))
    : undefined;
  const testSource = testRef ? 'explicit' : baseline ? 'baseline' : 'candidate';
  const tests = freezeSnapshot(
    repository,
    testRef || baseline?.commit || selected.commit,
    join(destination, 'tests')
  );
  const selectedProjects = projects.length ? projects : tests.projects;
  assert(
    selectedProjects.length &&
      selectedProjects.every((project) => tests.projects.includes(project)),
    'Requested project is absent from test source'
  );
  assert(
    nodes.length && nodes.every((node) => /^(?:22|24|26)\.(?:x|\d+\.\d+)$/.test(node)),
    'Use supported Node 22, 24, or 26 versions'
  );
  if (baseline) {
    const previousMajor = baseline.packages
      .find((pkg) => pkg.name === '@suites/unit')
      .version.split('.')[0];
    const nextMajor = selected.packages
      .find((pkg) => pkg.name === '@suites/unit')
      .version.split('.')[0];
    assert.equal(
      nextMajor,
      previousMajor,
      'Automatic compatibility comparison requires the same major version; use the standalone runner to assess intentional major changes'
    );
  }
  const matrix = {
    include: selectedProjects.flatMap((project) =>
      nodes.map((node) => ({
        project,
        node,
        id: `${project.replaceAll('/', '-')}-${node.replaceAll('.', '-')}`,
      }))
    ),
  };
  const compatibility = {
    ...(automatic ||
      (baseline
        ? {
            status: 'checked',
            baselineVersion: baseline.packages.find((pkg) => pkg.name === '@suites/unit').version,
            candidateMajor: Number(unitVersion.split('.')[0]),
          }
        : { status: 'not-requested', candidateMajor: Number(unitVersion.split('.')[0]) })),
    testSource,
  };
  const plan = {
    schema: 2,
    tests,
    target: selected,
    baseline: baseline || null,
    compatibility,
    matrix,
  };
  writeFileSync(join(destination, 'plan.json'), JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
  if (compatibility.status === 'skipped-new-major' && process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `No published stable @suites/unit ${unitVersion.split('.')[0]}.x release exists. Previous-release comparison is skipped; candidate consumers still run.\n`
    );
  console.log(
    JSON.stringify({
      tests: tests.commit,
      target: selected.label,
      baseline: baseline?.label,
      compatibility: compatibility.status,
      jobs: matrix.include.length,
    })
  );
  return plan;
}

if (require.main === module) {
  try {
    if (process.argv[2] === 'prepare') {
      prepare({
        repository: resolve(process.env.E2E_REPOSITORY || '.'),
        candidateRepository: resolve(process.env.E2E_CANDIDATE_REPOSITORY || '.'),
        destination: resolve(process.argv[3]),
        kind: process.env.E2E_TARGET_KIND || 'npm',
        target: process.env.E2E_TARGET || 'latest',
        testRef: process.env.E2E_TEST_REF || '',
        baselineVersion: process.env.E2E_BASELINE || '',
        projects: JSON.parse(process.env.E2E_PROJECTS || '[]'),
        nodes: JSON.parse(process.env.E2E_NODES || '["22.x","24.x","26.x"]'),
      });
    } else if (process.argv[2] === 'run') {
      runConsumer(process.argv[3], process.argv[4], resolve(process.argv[5]));
    } else {
      throw new Error(
        'Usage: node scripts/e2e/cli.cjs prepare <bundle> | run <bundle> <project> <workdir>'
      );
    }
  } catch (error) {
    console.error(error.stderr?.toString() || error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepare };
