const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const cases = require('./di-compatibility.json');

function installedVersion(requireFrom, name) {
  let directory = path.dirname(requireFrom.resolve(name));
  while (true) {
    const manifestPath = path.join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name === name) return manifest.version;
    }
    const parent = path.dirname(directory);
    assert.notEqual(parent, directory, `Cannot find manifest for ${name}`);
    directory = parent;
  }
}

function verify(framework, expected, directory) {
  const consumer = createRequire(path.join(directory, 'package.json'));
  const adapter = createRequire(consumer.resolve(`@suites/di.${framework}`));
  const dependency = framework === 'nestjs' ? '@nestjs/common' : 'inversify';
  const actual = installedVersion(consumer, dependency);
  assert.equal(
    installedVersion(adapter, dependency),
    actual,
    'Adapter framework differs from consumer'
  );
  assert.equal(actual, expected, `${dependency}: expected ${expected}, got ${actual}`);
  if (framework === 'nestjs') {
    assert.equal(installedVersion(consumer, '@nestjs/core'), actual);
  }
  console.log('Verified consumer and adapter:', dependency, actual);
}

function resolveVersion(framework, version, directory) {
  if (version.includes('.')) return version;
  const dependency = framework === 'nestjs' ? '@nestjs/common' : 'inversify';
  const published = JSON.parse(
    execFileSync('pnpm', ['view', `${dependency}@${version}`, 'version', '--json'], {
      cwd: directory,
      encoding: 'utf8',
    })
  );
  const versions = [published].flat().filter((value) => /^\d+\.\d+\.\d+$/.test(value));
  versions.sort((a, b) => {
    const left = a.split('.').map(Number);
    const right = b.split('.').map(Number);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  });
  const latest = versions.at(-1);
  assert.ok(
    latest && latest.split('.')[0] === version,
    `No stable release for ${dependency}@${version}`
  );
  return latest;
}

function run(project) {
  assert.match(project || '', /^(?:(?:esm\/)?(?:jest|vitest)\/nestjs|(?:jest|vitest)\/inversify)$/);
  const framework = project.split('/').at(-1);
  const directory = path.join(__dirname, project);
  const manifestPath = path.join(directory, 'package.json');
  const originalManifest = readFileSync(manifestPath, 'utf8');
  const nodeMajor = process.versions.node.split('.')[0];
  const pnpm = (...args) => execFileSync('pnpm', args, { cwd: directory, stdio: 'inherit' });
  const install = ['add', '--ignore-scripts', '--lockfile=false', '--strict-peer-dependencies'];

  try {
    pnpm(...install, '--save-dev', `@types/node@${nodeMajor}`);
    for (const { version, reflectMetadata } of cases[framework]) {
      // An explicit resolved version prevents pnpm from reusing the previous
      // minimum release just because it also satisfies a major-only request.
      const resolved = resolveVersion(framework, version, directory);
      console.log(`\n::group::${project}: ${framework}@${resolved}, Node ${nodeMajor}`);
      const dependencies =
        framework === 'nestjs'
          ? [`@nestjs/common@${resolved}`, `@nestjs/core@${resolved}`]
          : [`inversify@${resolved}`];
      pnpm(...install, '--save-exact', ...dependencies, `reflect-metadata@${reflectMetadata}`);

      // A fresh process avoids cached resolution paths after pnpm changes the
      // peer-specific adapter installation. Verify both copies to prevent a
      // silently installed newer peer from invalidating compatibility coverage.
      execFileSync(process.execPath, [__filename, '--verify', framework, resolved, directory], {
        stdio: 'inherit',
      });
      pnpm('test');
      console.log('::endgroup::');
    }
  } finally {
    writeFileSync(manifestPath, originalManifest);
  }
}

if (process.argv[2] === '--verify') {
  verify(process.argv[3], process.argv[4], process.argv[5]);
} else {
  run(process.argv[2]);
}
