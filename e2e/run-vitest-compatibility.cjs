const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  realpathSync,
  readdirSync,
} = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join, resolve, basename } = require('node:path');
const root = resolve(__dirname, '..');
const hostPaths = ['unit', 'core', 'types/common', 'types/di', 'types/doubles', 'di/nestjs'];
const registry = 'http://localhost:4873/';
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function run(command, args, cwd, timeout = 120000, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, NODE_OPTIONS: '', ...env },
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed in ${cwd}`);
}

// Run before the release simulation changes versions or removes source files.
// Every host version comes from this checkout, including maintenance branches.
function prepare(destination, candidateDirectory) {
  mkdirSync(destination, { recursive: true });
  const packages = hostPaths.map((path) => {
    const directory = join(root, 'packages', path);
    const { name, version } = JSON.parse(readFileSync(join(directory, 'package.json')));
    run('pnpm', ['pack', '--pack-destination', destination], directory);
    const archive = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    return { name, version, archive, sha256: digest(join(destination, archive)) };
  });
  const candidate = join(destination, 'candidate');
  mkdirSync(candidate, { recursive: true });
  if (candidateDirectory) {
    const archives = readdirSync(candidateDirectory).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1, 'Candidate artifact must contain exactly one tarball');
    cpSync(join(candidateDirectory, archives[0]), join(candidate, archives[0]));
  } else {
    run('pnpm', ['pack', '--pack-destination', candidate], join(root, 'packages/doubles/vitest'));
  }
  const archives = readdirSync(candidate).filter((file) => file.endsWith('.tgz'));
  assert.equal(archives.length, 1, 'Use a fresh output directory');
  const archive = join('candidate', archives[0]);
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOf', join(destination, archive), 'package/package.json'], {
      encoding: 'utf8',
    })
  );
  assert.equal(manifest.name, '@suites/doubles.vitest');
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const plan = {
    source,
    packages,
    adapter: { version: manifest.version, archive, sha256: digest(join(destination, archive)) },
  };
  writeFileSync(join(destination, 'branch.json'), JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify(plan, null, 2));
}

function packageDirectory(requireFrom, name) {
  for (const search of requireFrom.resolve.paths(name)) {
    const path = join(search, name);
    if (existsSync(join(path, 'package.json'))) return realpathSync(path);
  }
  assert.fail(`Cannot resolve ${name}`);
}

async function check(destination) {
  const plan = JSON.parse(readFileSync(join(destination, 'branch.json')));
  for (const item of [...plan.packages, plan.adapter]) {
    assert.equal(digest(join(destination, item.archive)), item.sha256, 'Packed artifact changed');
  }
  const workspace = mkdtempSync(join(tmpdir(), 'suites-vitest-branch-'));
  const npmrc = join(workspace, '.npmrc');
  // Suites cannot fall back to npmjs: e2e/config.yaml deliberately has no uplink for them.
  const deadline = Date.now() + 30000;
  while (true) {
    try {
      const response = await fetch(`${registry}-/ping`, { signal: AbortSignal.timeout(3000) });
      assert(response.ok, 'Local registry is not ready');
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  const username = `e2e-${randomUUID()}`;
  const registration = await fetch(`${registry}-/user/org.couchdb.user:${username}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: username, password: randomUUID(), type: 'user', roles: [] }),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(registration.status, 201, 'Cannot register temporary local-registry user');
  const { token } = await registration.json();
  assert(token, 'Local registry did not return a token');
  writeFileSync(
    npmrc,
    `registry=${registry}\n@suites:registry=${registry}\n//localhost:4873/:_authToken=${token}\n`,
    { mode: 0o600 }
  );
  const env = { NPM_CONFIG_USERCONFIG: npmrc, NPM_CONFIG_PROVENANCE: 'false' };
  for (const item of plan.packages) {
    run(
      'npm',
      [
        'publish',
        join(destination, item.archive),
        '--registry',
        registry,
        '--tag',
        'compatibility',
        '--ignore-scripts',
        '--provenance=false',
      ],
      workspace,
      120000,
      env
    );
  }
  const versions = Object.fromEntries(plan.packages.map((item) => [item.name, item.version]));
  console.log(
    `Branch ${plan.source}, Unit ${versions['@suites/unit']}, adapter SHA256 ${plan.adapter.sha256}`
  );
  // Exercise the existing E2E project with its own compiler and Vitest config.
  // Only the Suites package sources differ from a normal E2E run.
  const folder = join(workspace, 'e2e/vitest/nestjs');
  cpSync(join(__dirname, 'vitest/nestjs'), folder, {
    recursive: true,
    filter: (source) => basename(source) !== 'node_modules',
  });
  cpSync(join(__dirname, 'vitest/tsconfig.json'), join(workspace, 'e2e/vitest/tsconfig.json'));
  cpSync(join(__dirname, 'tsconfig.json'), join(workspace, 'e2e/tsconfig.json'));
  const manifestPath = join(folder, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath));
  for (const section of ['dependencies', 'devDependencies']) {
    for (const name of Object.keys(manifest[section] || {})) {
      if (name === '@suites/doubles.vitest') {
        manifest[section][name] = `file:${join(destination, plan.adapter.archive)}`;
      } else if (name.startsWith('@suites/')) {
        assert(versions[name], `No branch package for ${name}`);
        manifest[section][name] = versions[name];
      }
    }
  }
  manifest.devDependencies['@types/node'] = process.versions.node.split('.')[0];
  manifest.packageManager = 'pnpm@12.16.1';
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const settingsPath = join(folder, 'pnpm-workspace.yaml');
  const settings = existsSync(settingsPath)
    ? readFileSync(settingsPath, 'utf8').replace('lockfile: false', 'lockfile: true')
    : 'packages: []\n';
  writeFileSync(
    settingsPath,
    `${settings}\nstrictPeerDependencies: true\nverifyDepsBeforeRun: false\n`
  );
  run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], folder, 180000, env);
  const consumer = createRequire(manifestPath);
  const unit = createRequire(consumer.resolve('@suites/unit'));
  const adapter = createRequire(consumer.resolve('@suites/doubles.vitest'));
  for (const name of [
    '@suites/core.unit',
    '@suites/types.common',
    '@suites/types.di',
    '@suites/types.doubles',
  ]) {
    const host = packageDirectory(unit, name);
    assert.equal(packageDirectory(adapter, name), host, `Unit and adapter must share ${name}`);
    assert.equal(JSON.parse(readFileSync(join(host, 'package.json'))).version, versions[name]);
  }
  run('pnpm', ['test'], folder, 120000, env);
  cpSync(join(folder, 'pnpm-lock.yaml'), join(destination, 'vitest-nestjs.lock.yaml'));
  console.log(
    'Branch packages passed the regular Vitest/NestJS E2E suite and shared dependency identity checks.'
  );
}

if (require.main === module) {
  const [mode, directory, candidate] = process.argv.slice(2);
  assert(directory, 'Usage: --prepare OUTPUT [CANDIDATE_DIRECTORY] | --run OUTPUT');
  if (mode === '--prepare') prepare(resolve(directory), candidate && resolve(candidate));
  else {
    assert.equal(mode, '--run');
    check(resolve(directory)).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
