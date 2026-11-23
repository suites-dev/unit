const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { configure, verifyInstalled, runConsumer } = require('./e2e/consumer.cjs');
const { prepare } = require('./e2e/cli.cjs');
const { hashFile, verifySnapshot } = require('./e2e/source.cjs');
const { automaticCompatibility, selectPreviousVersion } = require('./e2e/targets.cjs');

test('automatic baselines use published stable versions in the candidate major', () => {
  assert.equal(
    selectPreviousVersion(['9.9.0', '10.2.0', '10.3.0', '10.4.0-rc.1', '11.0.0'], '10.4.0'),
    '10.3.0'
  );
  assert.equal(selectPreviousVersion(['10.3.0', '10.4.0', '10.5.0'], '10.4.0'), '10.4.0');
  assert.equal(selectPreviousVersion(['9.9.0', '10.0.0-beta.0'], '10.0.0'), undefined);
});

function candidatePackages(
  version,
  {
    coreVersion = version,
    jestVersion = version,
    vitestVersion = version,
    supportingVersion = version,
  } = {}
) {
  return [
    { name: '@suites/unit', version },
    { name: '@suites/core.unit', version: coreVersion },
    { name: '@suites/doubles.jest', version: jestVersion },
    { name: '@suites/doubles.vitest', version: vitestVersion },
    { name: '@suites/types.common', version: supportingVersion },
  ];
}

test('automatic compatibility skips only an initial, coordinated next-major candidate', () => {
  assert.deepEqual(
    automaticCompatibility(
      ['3.9.0', '4.1.2', '4.1.3', '5.0.0-next.1'],
      candidatePackages('4.1.4-next.0')
    ),
    {
      status: 'checked',
      baselineVersion: '4.1.3',
      candidateMajor: 4,
      latestStableVersion: '4.1.3',
    }
  );
  assert.deepEqual(
    automaticCompatibility(
      ['3.9.0', '4.1.3', '5.0.0-next.1'],
      candidatePackages('5.0.0-e2e.0', { supportingVersion: '4.0.3-e2e.0' })
    ),
    {
      status: 'skipped-new-major',
      candidateMajor: 5,
      previousMajor: 4,
      latestStableVersion: '4.1.3',
    }
  );
});

test('automatic compatibility fails closed on invalid major transitions', () => {
  const stable = ['3.9.0', '4.1.3'];
  assert.throws(
    () => automaticCompatibility(stable, candidatePackages('not-semver')),
    /valid exact semver/
  );
  assert.throws(
    () => automaticCompatibility(stable, candidatePackages('5.0.0-01')),
    /valid exact semver/
  );
  assert.throws(
    () => automaticCompatibility(stable, candidatePackages('4.1.3-next.0')),
    /older than latest stable/
  );
  assert.throws(
    () => automaticCompatibility(stable, candidatePackages('3.10.0')),
    /older than the latest stable major/
  );
  assert.throws(
    () => automaticCompatibility(stable, candidatePackages('6.0.0-next.0')),
    /exactly one major/
  );
  assert.throws(
    () => automaticCompatibility(stable, candidatePackages('5.1.0-next.0')),
    /start at 5\.0\.0/
  );
  assert.throws(
    () =>
      automaticCompatibility(stable, candidatePackages('5.0.0-next.0', { coreVersion: '4.1.3' })),
    /same major/
  );
  assert.throws(
    () => automaticCompatibility(['5.0.0-next.1'], candidatePackages('5.0.0-next.2')),
    /no stable releases/
  );
});

test('new-major preparation freezes candidate tests and persists the skipped comparison', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'suites-e2e-new-major-plan-'));
  const destination = join(root, 'bundle');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const commit = 'b'.repeat(40);
  const target = {
    kind: 'candidate',
    label: commit,
    commit,
    packages: candidatePackages('5.0.0-e2e.0'),
  };
  const snapshotRefs = [];
  let publishedCalls = 0;
  const plan = prepare(
    {
      repository: '/source',
      candidateRepository: '/candidate',
      destination,
      kind: 'candidate',
      target: commit,
      testRef: '',
      baselineVersion: 'previous',
      projects: [],
      nodes: ['26.x'],
    },
    {
      candidateTarget: () => target,
      automaticCompatibility: () => ({
        status: 'skipped-new-major',
        candidateMajor: 5,
        previousMajor: 4,
        latestStableVersion: '4.1.3',
      }),
      publishedTarget: () => {
        publishedCalls += 1;
        throw new Error('V4 baseline must not be prepared');
      },
      snapshot: (_repository, ref) => {
        snapshotRefs.push(ref);
        return { commit: ref, projects: ['jest/nestjs'], hashes: {} };
      },
    }
  );
  assert.equal(publishedCalls, 0);
  assert.deepEqual(snapshotRefs, [commit]);
  assert.equal(plan.schema, 2);
  assert.equal(plan.baseline, null);
  assert.deepEqual(plan.compatibility, {
    status: 'skipped-new-major',
    candidateMajor: 5,
    previousMajor: 4,
    latestStableVersion: '4.1.3',
    testSource: 'candidate',
  });
  assert.deepEqual(plan.matrix.include, [
    { project: 'jest/nestjs', node: '26.x', id: 'jest-nestjs-26-x' },
  ]);
  assert.deepEqual(JSON.parse(readFileSync(join(destination, 'plan.json'))), plan);
});

test('an ephemeral candidate version commit preserves the original PR test source', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'suites-e2e-versioned-candidate-plan-'));
  const destination = join(root, 'bundle');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceCommit = 'a'.repeat(40);
  const candidateCommit = 'b'.repeat(40);
  const snapshotRefs = [];
  const plan = prepare(
    {
      repository: '/source',
      candidateRepository: '/candidate',
      destination,
      kind: 'candidate',
      target: candidateCommit,
      testRef: sourceCommit,
      baselineVersion: 'previous',
      projects: [],
      nodes: ['26.x'],
    },
    {
      candidateTarget: () => ({
        kind: 'candidate',
        label: candidateCommit,
        commit: candidateCommit,
        packages: candidatePackages('5.0.0-compatibility.0', {
          supportingVersion: '4.0.3-compatibility.0',
        }),
      }),
      automaticCompatibility: () => ({
        status: 'skipped-new-major',
        candidateMajor: 5,
        previousMajor: 4,
        latestStableVersion: '4.1.3',
      }),
      snapshot: (_repository, ref) => {
        snapshotRefs.push(ref);
        return { commit: ref, projects: ['jest/nestjs'], hashes: {} };
      },
    }
  );
  assert.deepEqual(snapshotRefs, [sourceCommit]);
  assert.equal(plan.tests.commit, sourceCommit);
  assert.equal(plan.target.commit, candidateCommit);
  assert.equal(plan.compatibility.testSource, 'explicit');
});

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'suites-e2e-harness-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'tests'));
  writeFileSync(join(directory, 'tests', 'consumer.test.ts'), 'original test');
  const plan = {
    schema: 2,
    tests: {
      commit: 'a'.repeat(40),
      projects: ['jest/nestjs'],
      hashes: { 'consumer.test.ts': hashFile(join(directory, 'tests', 'consumer.test.ts')) },
    },
    baseline: { label: '10.3.0' },
    target: { label: '10.4.0' },
    compatibility: { status: 'checked', testSource: 'baseline' },
  };
  writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan));
  return { directory, plan, workdir: join(directory, 'consumer') };
}

test('a skipped new-major baseline runs only the candidate and reports the reason', (t) => {
  const { directory, plan, workdir } = fixture(t);
  const summary = join(directory, 'summary.md');
  const previousSummary = process.env.GITHUB_STEP_SUMMARY;
  process.env.GITHUB_STEP_SUMMARY = summary;
  t.after(() => {
    if (previousSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = previousSummary;
  });
  delete plan.baseline;
  plan.target = { label: 'b'.repeat(40) };
  plan.compatibility = {
    status: 'skipped-new-major',
    candidateMajor: 5,
    previousMajor: 4,
    latestStableVersion: '4.1.3',
    testSource: 'candidate',
  };
  writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan));
  const calls = [];
  const result = runConsumer(
    directory,
    'jest/nestjs',
    workdir,
    (_bundle, _plan, _project, target) => {
      calls.push(target.label);
      return { external: {} };
    }
  );
  assert.deepEqual(calls, [plan.target.label]);
  assert.equal(result.status, 'passed');
  assert.equal(result.baselineStatus, 'skipped-new-major');
  assert.equal(result.targetStatus, 'passed');
  assert.match(readFileSync(summary, 'utf8'), /Compatibility: \*\*skipped-new-major\*\*/);
  assert.match(readFileSync(summary, 'utf8'), /skipped \(no stable 5\.x release\)/);
});

test('a candidate failure propagates when the new-major baseline is skipped', (t) => {
  const { directory, plan, workdir } = fixture(t);
  delete plan.baseline;
  plan.target = { label: 'b'.repeat(40) };
  plan.compatibility = {
    status: 'skipped-new-major',
    candidateMajor: 5,
    previousMajor: 4,
    latestStableVersion: '4.1.3',
    testSource: 'candidate',
  };
  writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan));
  assert.throws(
    () =>
      runConsumer(directory, 'jest/nestjs', workdir, () => {
        throw new Error('V5 candidate assertion failed');
      }),
    /V5 candidate assertion failed/
  );
  const result = JSON.parse(readFileSync(join(workdir, 'result.json')));
  assert.equal(result.status, 'target-failed');
  assert.equal(result.baselineStatus, 'skipped-new-major');
  assert.equal(result.targetStatus, 'failed');
});

test('a failing baseline blocks target execution and reports unavailable verification', (t) => {
  const { directory, workdir } = fixture(t);
  const calls = [];
  assert.throws(
    () =>
      runConsumer(directory, 'jest/nestjs', workdir, (_bundle, _plan, _project, target) => {
        calls.push(target.label);
        throw new Error('baseline cannot run');
      }),
    /baseline cannot run/
  );
  assert.deepEqual(calls, ['10.3.0']);
  const result = JSON.parse(readFileSync(join(workdir, 'result.json')));
  assert.equal(result.status, 'baseline-unavailable');
  assert.equal(result.baselineStatus, 'failed');
  assert.equal(result.targetStatus, 'not-run');
});

test('a target failure after a passing baseline fails compatibility', (t) => {
  const { directory, workdir } = fixture(t);
  const baseline = { external: { jest: '30.5.2' } };
  const calls = [];
  assert.throws(
    () =>
      runConsumer(
        directory,
        'jest/nestjs',
        workdir,
        (_bundle, _plan, _project, target, _dir, previous) => {
          calls.push(target.label);
          if (target.label === '10.3.0') return baseline;
          assert.equal(previous, baseline);
          throw new Error('existing assertion failed');
        }
      ),
    /existing assertion failed/
  );
  assert.deepEqual(calls, ['10.3.0', '10.4.0']);
  const result = JSON.parse(readFileSync(join(workdir, 'result.json')));
  assert.equal(result.status, 'candidate-failed');
  assert.equal(result.baselineStatus, 'passed');
  assert.equal(result.targetStatus, 'failed');
});

test('successful pairs keep baseline and target in separate consumer directories', (t) => {
  const { directory, workdir } = fixture(t);
  const directories = [];
  const result = runConsumer(
    directory,
    'jest/nestjs',
    workdir,
    (_bundle, _plan, _project, _target, dest) => {
      directories.push(dest);
      return { external: {} };
    }
  );
  assert.equal(result.status, 'passed');
  assert.equal(result.baselineStatus, 'passed');
  assert.equal(result.targetStatus, 'passed');
  assert.deepEqual(directories, [join(workdir, 'baseline'), join(workdir, 'target')]);
});

test('target selection changes dependencies but preserves test commands and pins the external toolchain', () => {
  const original = {
    scripts: { test: 'tsc --noEmit && jest' },
    dependencies: { '@suites/unit': 'e2e' },
    devDependencies: { jest: '^30.0.0' },
  };
  const modified = configure(
    original,
    { '@suites/unit': 'file:/candidate/unit.tgz' },
    { jest: '30.5.2' }
  );
  assert.deepEqual(modified.scripts, original.scripts);
  assert.equal(modified.dependencies['@suites/unit'], 'file:/candidate/unit.tgz');
  assert.equal(modified.devDependencies.jest, '30.5.2');
  assert.equal(original.dependencies['@suites/unit'], 'e2e');
  assert.throws(() => configure(original, {}), /Target release has no/);
});

test('nested old Core copies cannot silently satisfy a candidate run', () => {
  const target = {
    packages: [
      { name: '@suites/unit', version: '10.4.0', archive: 'unit.tgz' },
      { name: '@suites/core.unit', version: '10.4.0', archive: 'core.tgz' },
    ],
  };
  const tree = [
    {
      dependencies: {
        '@suites/unit': {
          version: '10.4.0',
          resolved: 'file:/unit.tgz',
          dependencies: { '@suites/core.unit': { version: '10.3.0', resolved: 'file:/core.tgz' } },
        },
      },
    },
  ];
  assert.throws(() => verifyInstalled(tree, target), /Wrong installed version/);
  tree[0].dependencies['@suites/unit'].dependencies['@suites/core.unit'].version = '10.4.0';
  verifyInstalled(tree, target);
  tree[0].dependencies['@suites/unit'].resolved = 'https://registry.npmjs.org/unit.tgz';
  // The source verifier must distinguish local candidates from matching registry filenames.
  assert.throws(() => verifyInstalled(tree, target), /Candidate did not resolve/);
});

test('frozen test changes are detected before consumer execution', (t) => {
  const { directory, plan, workdir } = fixture(t);
  verifySnapshot(join(directory, 'tests'), plan.tests.hashes);
  writeFileSync(join(directory, 'tests', 'consumer.test.ts'), 'weakened test');
  let called = false;
  assert.throws(
    () =>
      runConsumer(directory, 'jest/nestjs', workdir, () => {
        called = true;
      }),
    /Test source changed/
  );
  assert.equal(called, false);
});
