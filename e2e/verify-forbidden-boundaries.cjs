const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const console = require('node:console');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const process = require('node:process');

const runner = process.argv[2];
assert.match(runner || '', /^(jest|vitest)$/);
const configFile =
  process.argv[3] || (runner === 'jest' ? 'jest.forbid.config.cjs' : 'vitest.forbid.config.ts');

const directory = mkdtempSync(join(tmpdir(), 'suites-forbid-report-'));
const outputFile = join(directory, 'results.json');
const stepsFile = join(directory, 'steps.txt');

try {
  const args =
    runner === 'jest'
      ? ['--config', configFile, '--runInBand', '--json', '--outputFile', outputFile]
      : ['run', '--config', configFile, '--reporter=json', '--outputFile', outputFile];

  const result = spawnSync('pnpm', ['exec', runner, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SUITES_FORBID_RUNNER: runner,
      SUITES_FORBID_STEPS_FILE: stepsFile,
    },
    timeout: 60_000,
  });
  assert.ifError(result.error);
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1, output);
  assert.ok(existsSync(outputFile), `${runner} did not produce a test report.\n${output}`);

  const report = JSON.parse(readFileSync(outputFile, 'utf8'));
  assert.equal(report.success, false, `Expected a failed ${runner} report.\n${output}`);
  const failedFiles = report.testResults.filter((file) => file.status === 'failed');
  assert.ok(failedFiles.length > 0, `Expected a failed ${runner} file or suite.\n${output}`);
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  assert.ok(tests.length >= 4, `Expected the forbid contract tests.\n${output}`);

  assert.equal(report.numFailedTestSuites, 1, output);
  assert.equal(report.numFailedTests, 0, output);
  assert.equal(report.numPassedTests, tests.length, output);
  for (const test of tests) assert.equal(test.status, 'passed', test.title);

  const diagnostics = failedFiles
    .flatMap((file) => [
      file.failureMessage,
      file.message,
      ...file.assertionResults.flatMap((test) => test.failureMessages),
    ])
    .filter(Boolean)
    .join('\n');
  assert.match(diagnostics, /forbidden dependency/i, diagnostics || output);
  assert.match(diagnostics, /Dependency path:/i, diagnostics || output);

  assert.ok(existsSync(stepsFile), `${runner} did not record caught boundary accesses.\n${output}`);
  const steps = readFileSync(stepsFile, 'utf8').trim().split('\n');
  for (const step of [`${runner}:constructor-caught`, `${runner}:token-caught`]) {
    assert.ok(steps.includes(step), `Missing completed step ${step}.\n${output}`);
  }
  if (tests.some((test) => test.title.includes('property-injected'))) {
    assert.ok(steps.includes(`${runner}:property-caught`), output);
  }

  console.log(`${runner}: verified forbidden composition boundaries in consumer tests`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
