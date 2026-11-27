const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const process = require('node:process');

const format = process.argv[2];
assert.ok(['commonjs', 'module'].includes(format));
const directory = mkdtempSync(join(tmpdir(), 'suites-adapter-loading-'));
const scope = join(directory, 'node_modules/@suites');
const installed = join(process.cwd(), 'node_modules/@suites/unit');
const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
const fromUnit = createRequire(realpathSync(join(installed, 'package.json')));
const packages = { di: 'di.nestjs', doubles: 'doubles.jest' };
const valid = {
  di: 'exports.adapter = { inspect: () => ({ list: () => [], resolve: () => undefined }) };',
  doubles: 'exports.adapter = { mock: () => ({}), stub: () => () => {} };',
};

function installAdapter(kind, scenario) {
  const path = join(scope, packages[kind]);
  rmSync(path, { recursive: true, force: true });
  if (scenario === 'missing') return;
  mkdirSync(path);
  if (scenario === 'broken-entry' || scenario === 'invalid-exports') {
    const entry = scenario === 'broken-entry' ? './missing.cjs' : '../invalid.cjs';
    writeFileSync(join(path, 'package.json'), JSON.stringify({ exports: entry }));
    return;
  }
  const sources = {
    valid: valid[kind],
    throws: 'throw globalThis.adapterFailure;',
    'no-export': 'exports.unrelated = true;',
    malformed:
      kind === 'di' ? 'exports.adapter = { inspect: 1 };' : 'exports.adapter = { mock() {} };',
  };
  writeFileSync(join(path, 'index.js'), 'globalThis.adapterInitializations++;\n' + sources[scenario]);
}

try {
  // Isolate adapter discovery while using the consumer's installed Unit build and dependencies.
  mkdirSync(join(scope, 'unit'), { recursive: true });
  cpSync(join(installed, 'package.json'), join(scope, 'unit/package.json'));
  cpSync(join(installed, 'dist'), join(scope, 'unit/dist'), { recursive: true });
  for (const name of Object.keys(manifest.dependencies)) {
    const parent = fromUnit.resolve.paths(name).find((path) => existsSync(join(path, name)));
    assert.ok(parent, `Installed Unit dependency missing: ${name}`);
    symlinkSync(join(parent, name), join(directory, 'node_modules', name), 'dir');
  }

  cpSync(join(__dirname, 'fixtures/adapter-loading.cjs'), join(directory, 'verify.cjs'));
  const entry =
    format === 'module'
      ? "import { TestBed } from '@suites/unit'; import verify from './verify.cjs';"
      : "const { TestBed } = require('@suites/unit'); const verify = require('./verify.cjs');";
  const script =
    entry +
    'verify(TestBed, ...process.argv.slice(1)).catch(error => { console.error(error); process.exitCode = 1; });';
  for (const [kind, name] of Object.entries(packages)) {
    for (const scenario of [
      'valid',
      'missing',
      'throws',
      'no-export',
      'malformed',
      'broken-entry',
      'invalid-exports',
    ]) {
      for (const adapter of Object.keys(packages)) {
        installAdapter(adapter, adapter === kind ? scenario : 'valid');
      }
      const result = spawnSync(
        process.execPath,
        [
          '--unhandled-rejections=strict',
          '--input-type',
          format,
          '--eval',
          script,
          scenario,
          '@suites/' + name,
        ],
        {
          cwd: directory,
          encoding: 'utf8',
          env: { ...process.env, NODE_PATH: '' },
        }
      );
      assert.ifError(result.error);
      assert.equal(result.status, 0, `${format} ${kind} ${scenario}\n${result.stderr}`);
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
