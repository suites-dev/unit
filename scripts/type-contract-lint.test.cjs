const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ESLint } = require('eslint');
const { join } = require('node:path');

const root = join(__dirname, '..');
const linter = new ESLint({
  cwd: root,
  overrideConfigFile: join(__dirname, 'eslint-type-contracts.config.mjs'),
});

test('rejects chained assertions across authored package sources, tests and declarations', async () => {
  for (const filePath of [
    'packages/core/src/services/dependency-resolver.ts',
    'packages/di/nestjs/metadata.d.ts',
    'packages/doubles/jest/src/mock.static.ts',
    'packages/doubles/vitest/vitest.config.mts',
    'packages/unit/__test__/assets/test-adapter.ts',
    'packages/unit/__test__/package-resolver.base.spec.ts',
    'packages/runners/jest/src/index.ts',
  ]) {
    const [result] = await linter.lintText(
      'declare const input: unknown; const first = (input as string) as number; const second = <number><string>input;',
      { filePath }
    );
    assert.deepEqual(
      result.messages.map(({ ruleId }) => ruleId),
      ['no-restricted-syntax', 'no-restricted-syntax']
    );
  }
});

test('requires immutable fields on each state while allowing optional method arguments', async () => {
  const filePath = 'packages/core/src/services/builders/sociable-unit-builder.ts';
  const [invalid] = await linter.lintText(
    'type ConstructionMode = { readonly mode: "selective"; selection?: string };',
    { filePath }
  );
  assert.equal(invalid.errorCount, 2);

  const [valid] = await linter.lintText(
    'type ConstructionMode = { readonly mode: "selective"; readonly selection: string } | { readonly mode: "composed" }; declare function lookup(qualifier?: string): void;',
    { filePath }
  );
  assert.deepEqual(valid.messages, []);
});

test('allows optional and mutable properties outside the named core state contracts', async () => {
  const [result] = await linter.lintText('interface Example { enabled?: boolean }', {
    filePath: 'packages/core/src/services/dependency-resolver.ts',
  });
  assert.deepEqual(result.messages, []);
});
