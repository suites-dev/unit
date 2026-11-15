const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
let registryCache;

function execute(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function npmRegistry(args, cwd) {
  if (!registryCache) {
    registryCache = mkdtempSync(join(tmpdir(), 'suites-e2e-registry-'));
    process.once('exit', () => rmSync(registryCache, { recursive: true, force: true }));
  }
  return JSON.parse(
    execute(
      'npm',
      [
        ...args,
        '--json',
        '--prefer-online',
        '--cache',
        registryCache,
        '--registry=https://registry.npmjs.org/',
        '--fetch-retries=1',
        '--fetch-timeout=30000',
      ],
      cwd
    )
  );
}

function registryPackage(specification, cwd) {
  return npmRegistry(['view', specification], cwd);
}

function registryVersions(cwd) {
  return npmRegistry(['view', '@suites/unit', 'versions'], cwd);
}

module.exports = { execute, npmRegistry, registryPackage, registryVersions };
