const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { execute } = require('./process.cjs');
const { hashFile, verifySnapshot } = require('./source.cjs');

function specifications(target, bundle) {
  return Object.fromEntries(
    target.packages.map((pkg) => {
      if (!pkg.archive) return [pkg.name, pkg.version];
      assert.match(pkg.archive, /^(npm|candidate)\/[a-zA-Z0-9._-]+\.tgz$/);
      const archive = join(bundle, 'packages', pkg.archive);
      assert.equal(hashFile(archive), pkg.sha256, `Candidate artifact changed: ${pkg.name}`);
      return [pkg.name, `file:${archive}`];
    })
  );
}

function configure(manifest, targetSpecs, externalVersions = {}) {
  const result = structuredClone(manifest);
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(result[section] || {})) {
      if (name.startsWith('@suites/')) {
        assert(targetSpecs[name], `Target release has no ${name}`);
        result[section][name] = targetSpecs[name];
      } else if (externalVersions[name]) {
        result[section][name] = externalVersions[name];
      }
    }
  }
  return result;
}

function installedPackages(directory) {
  return JSON.parse(execute('pnpm', ['list', '--depth', '1000', '--json'], directory));
}

function verifyInstalled(tree, target) {
  const expected = new Map(target.packages.map((pkg) => [pkg.name, pkg]));
  const seen = new Set();
  function visit(entry) {
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, dependency] of Object.entries(entry[section] || {})) {
        if (name.startsWith('@suites/')) {
          assert(expected.has(name), `Unexpected Suites package: ${name}`);
          const pkg = expected.get(name);
          assert.equal(dependency.version, pkg.version, `Wrong installed version: ${name}`);
          if (pkg.archive)
            assert(
              dependency.resolved?.startsWith('file:') && dependency.resolved.endsWith(pkg.archive),
              `Candidate did not resolve from its artifact: ${name}`
            );
          seen.add(name);
        }
        visit(dependency);
      }
    }
  }
  tree.forEach(visit);
  assert(seen.has('@suites/unit'), 'Consumer did not install Unit');
}

function externalVersions(tree) {
  return Object.fromEntries(
    ['dependencies', 'devDependencies', 'optionalDependencies'].flatMap((section) =>
      Object.entries(tree[0][section] || {})
        .filter(([name]) => !name.startsWith('@suites/'))
        .map(([name, dependency]) => [name, dependency.version])
    )
  );
}

function phase(bundle, plan, project, target, directory, baseline) {
  cpSync(join(bundle, 'tests', 'e2e'), join(directory, 'e2e'), { recursive: true });
  const consumer = join(directory, 'e2e', project);
  const manifestPath = join(consumer, 'package.json');
  const original = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const specs = specifications(target, bundle);
  writeFileSync(
    manifestPath,
    JSON.stringify(configure(original, specs, baseline?.external), null, 2)
  );
  const workspace = join(consumer, 'pnpm-workspace.yaml');
  if (!existsSync(workspace)) writeFileSync(workspace, 'packages: []\n');
  const originalOverrides = execute(
    'pnpm',
    ['config', 'get', '--location=project', '--json', 'overrides'],
    consumer
  ).trim();
  const overrides =
    originalOverrides && originalOverrides !== 'undefined' ? JSON.parse(originalOverrides) : {};
  execute(
    'pnpm',
    [
      'config',
      'set',
      '--location=project',
      '--json',
      'overrides',
      JSON.stringify({ ...overrides, ...specs }),
    ],
    consumer
  );
  execute('pnpm', ['config', 'set', '--location=project', '--json', 'lockfile', 'true'], consumer);
  const expectedWorkspace = readFileSync(workspace, 'utf8');
  const dependencyFiles = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'].map(
    (file) => `e2e/${project}/${file}`
  );
  if (baseline)
    copyFileSync(join(baseline.consumer, 'pnpm-lock.yaml'), join(consumer, 'pnpm-lock.yaml'));
  const log = join(directory, 'consumer.log');
  const descriptor = openSync(log, 'w');
  const env = { ...process.env, CI: 'true', NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/' };
  delete env.NODE_PATH;
  const run = (args) => {
    const result = spawnSync('pnpm', args, {
      cwd: consumer,
      env,
      stdio: ['ignore', descriptor, descriptor],
      timeout: 20 * 60 * 1000,
    });
    assert.equal(result.error, undefined, `Consumer process failed: ${result.error?.message}`);
    assert.equal(result.status, 0, `pnpm ${args.join(' ')} failed (${result.status}); see ${log}`);
  };
  try {
    run([
      'install',
      '--no-frozen-lockfile',
      '--ignore-scripts',
      '--strict-peer-dependencies',
      '--registry=https://registry.npmjs.org/',
    ]);
    const tree = installedPackages(consumer);
    verifyInstalled(tree, target);
    const external = externalVersions(tree);
    if (baseline)
      assert.deepEqual(
        external,
        baseline.external,
        'External consumer dependencies changed between baseline and candidate'
      );
    assert.deepEqual(
      JSON.parse(readFileSync(manifestPath, 'utf8')).scripts,
      original.scripts,
      'Consumer test commands changed'
    );
    assert.equal(
      readFileSync(workspace, 'utf8'),
      expectedWorkspace,
      'Consumer installation settings changed'
    );
    verifySnapshot(directory, plan.tests.hashes, dependencyFiles);
    run(['test']);
    assert.deepEqual(
      JSON.parse(readFileSync(manifestPath, 'utf8')).scripts,
      original.scripts,
      'Consumer test commands changed'
    );
    assert.equal(
      readFileSync(workspace, 'utf8'),
      expectedWorkspace,
      'Consumer installation settings changed'
    );
    verifySnapshot(directory, plan.tests.hashes, dependencyFiles);
    writeFileSync(join(directory, 'installed.json'), JSON.stringify(tree, null, 2));
    return { consumer, external };
  } finally {
    closeSync(descriptor);
  }
}

function runConsumer(bundle, project, workdir, runPhase = phase) {
  bundle = resolve(bundle);
  const plan = JSON.parse(readFileSync(join(bundle, 'plan.json'), 'utf8'));
  assert.equal(plan.schema, 1);
  assert(
    plan.tests.projects.includes(project),
    'Project must be present in the frozen test snapshot'
  );
  assert(!existsSync(workdir), 'Use a fresh work directory for each consumer run');
  mkdirSync(workdir, { recursive: true });
  verifySnapshot(join(bundle, 'tests'), plan.tests.hashes);
  const result = {
    project,
    node: process.version,
    testCommit: plan.tests.commit,
    target: plan.target.label,
    baseline: plan.baseline?.label,
    status: 'baseline-unavailable',
  };
  try {
    let baseline;
    if (plan.baseline) {
      console.log(`Baseline ${plan.baseline.label}: ${project}`);
      baseline = runPhase(bundle, plan, project, plan.baseline, join(workdir, 'baseline'));
    }
    result.status = plan.baseline ? 'candidate-failed' : 'target-failed';
    console.log(`Target ${plan.target.label}: ${project}`);
    runPhase(bundle, plan, project, plan.target, join(workdir, 'target'), baseline);
    result.status = 'passed';
    console.log(
      `Passed ${project}: tests ${plan.tests.commit}, target ${plan.target.label}, Node ${process.version}`
    );
  } catch (error) {
    result.error = error.message;
    throw error;
  } finally {
    writeFileSync(join(workdir, 'result.json'), JSON.stringify(result, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) {
      require('node:fs').appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Consumer verification: ${project}\n\n- Tests: \`${plan.tests.commit}\`\n- Target: \`${plan.target.label}\`\n- Baseline: \`${plan.baseline?.label || 'not requested'}\`\n- Node: \`${process.version}\`\n- Result: **${result.status}**\n`
      );
    }
  }
  return result;
}

module.exports = { configure, verifyInstalled, externalVersions, runConsumer };
