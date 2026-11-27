const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const process = require('node:process');
const requireFromConsumer = createRequire(path.join(process.cwd(), 'package.json'));
const ts = requireFromConsumer('typescript');

const options = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

for (const [extension, mode, directory] of [
  ['cts', ts.ModuleKind.CommonJS, 'cjs'],
  ['mts', ts.ModuleKind.ESNext, 'esm'],
]) {
  const containingFile = path.join(process.cwd(), `unit-declaration-probe.${extension}`);
  const resolved = ts.resolveModuleName(
    '@suites/unit',
    containingFile,
    options,
    ts.sys,
    undefined,
    undefined,
    mode
  ).resolvedModule?.resolvedFileName;

  assert.ok(
    resolved && resolved.replaceAll(path.sep, '/').endsWith(`/dist/${directory}/index.d.ts`),
    `${extension} must resolve the ${directory} declaration; resolved ${resolved ?? 'nothing'}`
  );
}
