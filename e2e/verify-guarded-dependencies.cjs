const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const console = require('node:console');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const process = require('node:process');

const runner = process.argv[2];
const directory = mkdtempSync(join(tmpdir(), 'suites-guard-report-'));
const outputFile = join(directory, 'results.json');
const customOutputFile = join(directory, 'custom-environment-results.json');
const missingOutputFile = join(directory, 'missing-integration-results.json');
const stepsFile = join(directory, 'steps.txt');

try {
  const args =
    runner === 'jest'
      ? ['--config', 'jest.guards.config.cjs', '--runInBand', '--json', '--outputFile', outputFile]
      : [
          'run',
          '--config',
          'vitest.guards.config.ts',
          '--reporter=json',
          '--outputFile',
          outputFile,
        ];

  const result = spawnSync('pnpm', ['exec', runner, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SUITES_GUARD_STEPS_FILE: stepsFile },
    timeout: 60_000,
  });
  assert.ifError(result.error);
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1, output);

  assert.ok(existsSync(outputFile), `${runner} did not produce a test report.\n${output}`);
  const report = JSON.parse(readFileSync(outputFile, 'utf8'));
  assert.equal(report.numFailedTestSuites, 1, output);
  assert.equal(report.numFailedTests, 0, output);
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  const passing = [
    'allows a dependency to be injected without being used',
    'uses an explicitly exposed real dependency',
  ];
  const guarded = [
    'fails even when an exception assertion catches the guard',
    'fails even when application code catches the guard',
    'records a violation in a nested sibling suite',
    'keeps verification installed for a later sibling suite',
    'fails despite the expected-failure annotation',
    'fails when a clean retry follows a caught guard',
  ];
  const findTest = (title) => {
    const test = tests.find((entry) => entry.title === title);
    assert.ok(test, `Missing test "${title}" from ${runner} report.\n${output}`);
    return test;
  };

  for (const title of [...passing, ...guarded]) {
    assert.equal(findTest(title).status, 'passed', title);
  }

  const skipped = findTest('does not verify a skipped test');
  assert.match(skipped.status, /^(pending|skipped)$/, skipped.title);
  if (runner === 'vitest') {
    const cleanDynamicSkip = findTest('allows a clean dynamic skip');
    assert.match(cleanDynamicSkip.status, /^(pending|skipped)$/, cleanDynamicSkip.title);
    const dynamicSkip = findTest('fails when a caught guard is followed by a dynamic skip');
    assert.match(dynamicSkip.status, /^(pending|skipped)$/, dynamicSkip.title);
  }

  const suiteMessages = report.testResults.map((file) => file.message).join('\n');
  assert.match(suiteMessages, /Suites Unit rule violation:[^\n]*undeclared dependency/i);
  assert.match(suiteMessages, /Dependency path:[^\n]*\bCheckout\b[^\n]*\bInventory\b/i);

  assert.ok(existsSync(stepsFile), `${runner} did not record completed assertions.\n${output}`);
  const recordedSteps = readFileSync(stepsFile, 'utf8').trim().split('\n');
  for (const step of [
    `${runner}:immediate-error-asserted`,
    `${runner}:application-catch-asserted`,
    `${runner}:nested-sibling-caught`,
    `${runner}:later-sibling-caught`,
    `${runner}:retry-first-caught`,
    `${runner}:retry-second-clean`,
    `${runner}:teardown-caught`,
  ]) {
    assert.ok(recordedSteps.includes(step), `Missing completed step ${step}.\n${output}`);
  }
  if (runner === 'vitest') {
    assert.ok(recordedSteps.includes('vitest:dynamic-skip-after-guard'), output);
  }

  assert.equal(tests.length, passing.length + guarded.length + (runner === 'vitest' ? 3 : 1), output);

  const missingArgs =
    runner === 'jest'
      ? [
          '--config',
          'jest.missing-guards.config.cjs',
          '--runInBand',
          '--json',
          '--outputFile',
          missingOutputFile,
        ]
      : [
          'run',
          '--config',
          'vitest.missing-guards.config.ts',
          '--reporter=json',
          '--outputFile',
          missingOutputFile,
        ];
  const missingResult = spawnSync('pnpm', ['exec', runner, ...missingArgs], {
    encoding: 'utf8',
    env: process.env,
    timeout: 60_000,
  });
  assert.ifError(missingResult.error);
  const missingOutput = missingResult.stdout + missingResult.stderr;
  assert.equal(missingResult.status, 1, missingOutput);
  assert.match(missingOutput, /dependency verification is not configured/i);
  assert.match(missingOutput, runner === 'jest' ? /testEnvironment/i : /setupFiles/i);
  assert.ok(existsSync(missingOutputFile), `${runner} did not produce a missing-setup report.`);

  if (runner === 'jest') {
    const customResult = spawnSync(
      'pnpm',
      [
        'exec',
        'jest',
        '--config',
        'jest.custom-guards.config.cjs',
        '--runInBand',
        '--json',
        '--outputFile',
        customOutputFile,
      ],
      { encoding: 'utf8', env: process.env, timeout: 60_000 }
    );
    assert.ifError(customResult.error);
    const customOutput = customResult.stdout + customResult.stderr;
    assert.equal(customResult.status, 1, customOutput);
    const customReport = JSON.parse(readFileSync(customOutputFile, 'utf8'));
    assert.equal(customReport.numFailedTestSuites, 1, customOutput);
    assert.equal(customReport.numFailedTests, 0, customOutput);
    assert.equal(customReport.numPassedTests, 1, customOutput);
    assert.match(
      customReport.testResults.map((file) => file.message).join('\n'),
      /Suites Unit rule violation:[^\n]*undeclared dependency/i
    );
  }

  console.log(`${runner}: verified guarded dependencies in consumer tests`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
