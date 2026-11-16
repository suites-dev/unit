const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { configure, verifyInstalled, runConsumer } = require('./e2e/consumer.cjs');
const { hashFile, verifySnapshot } = require('./e2e/source.cjs');
const { selectPreviousVersion } = require('./e2e/targets.cjs');

test('automatic baselines use published stable versions in the candidate major', () => {
  assert.equal(
    selectPreviousVersion(['9.9.0', '10.2.0', '10.3.0', '10.4.0-rc.1', '11.0.0'], '10.4.0'),
    '10.3.0'
  );
  assert.equal(selectPreviousVersion(['10.3.0', '10.4.0', '10.5.0'], '10.4.0'), '10.4.0');
  assert.throws(
    () => selectPreviousVersion(['9.9.0', '10.0.0-beta.0'], '10.0.0'),
    /No published stable baseline/
  );
});

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'suites-e2e-harness-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'tests'));
  writeFileSync(join(directory, 'tests', 'consumer.test.ts'), 'original test');
  const plan = {
    schema: 1,
    tests: {
      commit: 'a'.repeat(40),
      projects: ['jest/nestjs'],
      hashes: { 'consumer.test.ts': hashFile(join(directory, 'tests', 'consumer.test.ts')) },
    },
    baseline: { label: '10.3.0' },
    target: { label: '10.4.0' },
  };
  writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan));
  return { directory, plan, workdir: join(directory, 'consumer') };
}

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
