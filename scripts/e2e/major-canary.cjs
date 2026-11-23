const assert = require('node:assert/strict');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { prepare } = require('./cli.cjs');
const { revision } = require('./source.cjs');
const { automaticCompatibility } = require('./targets.cjs');

const v5ReleaseGroup = new Set([
  '@suites/core.unit',
  '@suites/doubles.jest',
  '@suites/doubles.vitest',
  '@suites/unit',
]);

function prepareBundle(destination, repository) {
  repository = resolve(repository);
  return prepare(
    {
      repository,
      candidateRepository: repository,
      destination: resolve(destination),
      kind: 'candidate',
      target: 'HEAD',
      testRef: '',
      baselineVersion: 'previous',
      projects: ['jest/nestjs'],
      nodes: ['26.x'],
    },
    {
      // Keep the old-registry state deterministic while still packing and installing real tarballs.
      automaticCompatibility: (_repository, packages) =>
        automaticCompatibility(['4.1.3'], packages),
    }
  );
}

function verifyPlan(bundle, repository) {
  const plan = JSON.parse(readFileSync(join(resolve(bundle), 'plan.json'), 'utf8'));
  const commit = revision(resolve(repository), 'HEAD');
  assert.equal(plan.schema, 2);
  assert.equal(plan.baseline, null, 'New-major canary unexpectedly prepared a V4 baseline');
  assert.equal(plan.compatibility.status, 'skipped-new-major');
  assert.equal(plan.compatibility.candidateMajor, 5);
  assert.equal(plan.compatibility.previousMajor, 4);
  assert.equal(plan.compatibility.testSource, 'candidate');
  assert.match(plan.compatibility.latestStableVersion, /^4\.\d+\.\d+$/);
  assert.equal(plan.tests.commit, commit, 'Canary did not freeze candidate tests');
  assert.equal(plan.target.commit, commit, 'Canary did not pack the candidate commit');
  assert.deepEqual(plan.matrix.include, [
    { project: 'jest/nestjs', node: '26.x', id: 'jest-nestjs-26-x' },
  ]);
  const releaseGroup = plan.target.packages.filter((pkg) => v5ReleaseGroup.has(pkg.name));
  const supporting = plan.target.packages.filter((pkg) => !v5ReleaseGroup.has(pkg.name));
  assert.equal(releaseGroup.length, v5ReleaseGroup.size);
  assert(
    releaseGroup.every((pkg) => pkg.version === '5.0.0-e2e.0'),
    'Canary declaration packages must use the coordinated V5 version'
  );
  assert(
    supporting.length > 0 && supporting.every((pkg) => pkg.version.startsWith('4.')),
    'Canary supporting packages must remain independently versioned on V4'
  );
}

function verifyResult(workdir, expectedTargetStatus) {
  workdir = resolve(workdir);
  const result = JSON.parse(readFileSync(join(workdir, 'result.json'), 'utf8'));
  assert.equal(result.baseline, undefined);
  assert.equal(result.baselineStatus, 'skipped-new-major');
  assert.equal(result.targetStatus, expectedTargetStatus);
  assert.equal(result.status, expectedTargetStatus === 'passed' ? 'passed' : 'target-failed');
  assert.equal(existsSync(join(workdir, 'baseline')), false, 'V4 baseline directory was created');
  assert.equal(existsSync(join(workdir, 'target')), true, 'V5 target directory was not created');
}

function injectFailure(repository) {
  const manifestPath = join(resolve(repository), 'e2e', 'jest', 'nestjs', 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert(manifest.scripts?.test, 'Canary consumer has no test command');
  manifest.scripts.test = 'node -e "process.exit(17)"';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (require.main === module) {
  if (process.argv[2] === 'prepare') prepareBundle(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'verify-plan') verifyPlan(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'verify-result') verifyResult(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'inject-failure') injectFailure(process.argv[3]);
  else
    throw new Error(
      'Use prepare <bundle> <repository>, verify-plan <bundle> <repository>, verify-result <workdir> <status>, or inject-failure <repository>'
    );
}

module.exports = { injectFailure, prepareBundle, verifyPlan, verifyResult };
