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
    timeout: 60_000,
  });
  assert.ifError(result.error);
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1, output);

  assert.ok(existsSync(outputFile), `${runner} did not produce a test report.\n${output}`);
  const report = JSON.parse(readFileSync(outputFile, 'utf8'));
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  const passing = [
    'allows a dependency to be injected without being used',
    'uses an explicitly exposed real dependency',
    'uses an explicitly mocked dependency',
  ];
  const failing = [
    'fails even when an exception assertion catches the guard',
    'fails even when application code catches the guard',
    'fails despite the expected-failure annotation',
    'fails when a clean retry follows a caught guard',
  ];
  if (runner === 'vitest') failing.push('fails when a caught guard is followed by a dynamic skip');
  const findTest = (title) => {
    const test = tests.find((entry) => entry.title === title);
    assert.ok(test, `Missing test "${title}" from ${runner} report.\n${output}`);
    return test;
  };

  for (const title of passing) assert.equal(findTest(title).status, 'passed', title);

  const skipped = findTest('does not verify a skipped test');
  assert.match(skipped.status, /^(pending|skipped)$/, skipped.title);

  for (const title of failing) {
    const test = findTest(title);
    assert.equal(test.status, 'failed', title);
    const messages = test.failureMessages.join('\n');
    assert.match(messages, /an undeclared dependency was used/i, messages);
    assert.match(messages, /Dependency path:[^\n]*\bCheckout\b[^\n]*\bInventory\b/i, messages);
  }

  assert.equal(tests.length, passing.length + failing.length + 1, output);
  console.log(`${runner}: verified guarded dependencies in consumer tests`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
