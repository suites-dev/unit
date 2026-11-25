const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ESLint } = require('eslint');
const { join } = require('node:path');

const root = join(__dirname, '..');
const linter = new ESLint({
  cwd: root,
  overrideConfigFile: join(__dirname, 'eslint-type-contracts.config.mjs'),
});

test('rejects chained assertions in implementation and declaration entry points', async () => {
  for (const filePath of [
    'packages/core/src/services/dependency-resolver.ts',
    'packages/di/nestjs/metadata.d.ts',
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
