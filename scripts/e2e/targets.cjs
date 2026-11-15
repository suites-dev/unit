const assert = require('node:assert/strict');
const { mkdirSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { execute, npmRegistry, registryPackage, registryVersions } = require('./process.cjs');
const { revision, manifests, hashFile } = require('./source.cjs');

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function selectPreviousVersion(versions, candidateVersion) {
  const candidate = candidateVersion.split('-')[0].split('.').map(Number);
  const compare = (left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  const eligible = versions
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .map((version) => version.split('.').map(Number))
    .filter((version) => version[0] === candidate[0] && compare(version, candidate) <= 0)
    .sort(compare);
  assert(
    eligible.length,
    `No published stable baseline exists for candidate ${candidateVersion}; use the standalone runner for a major-version assessment`
  );
  return eligible.at(-1).join('.');
}

function previousVersion(repository, candidateVersion) {
  return selectPreviousVersion(registryVersions(repository), candidateVersion);
}

function publishedTarget(repository, requested, destination) {
  assert(
    requested === 'latest' || versionPattern.test(requested),
    'Use an exact npm version or latest'
  );
  const unit = registryPackage(`@suites/unit@${requested}`, repository);
  assert(versionPattern.test(unit.version), 'npm did not return a single release');
  assert.match(unit.gitHead || '', /^[a-f0-9]{40}$/, 'Published Unit release has no source commit');
  const commit = revision(repository, unit.gitHead);
  const source = manifests(repository, commit);
  assert.equal(
    source.find((pkg) => pkg.name === '@suites/unit')?.version,
    unit.version,
    'Published version and source disagree'
  );
  const packages = source.map((pkg) => {
    const published = registryPackage(`${pkg.name}@${pkg.version}`, repository);
    assert.equal(published.name, pkg.name);
    assert.equal(published.version, pkg.version);
    assert(published.dist?.integrity, `Missing integrity for ${pkg.name}@${pkg.version}`);
    mkdirSync(join(destination, 'npm'), { recursive: true });
    const [packed] = npmRegistry(
      [
        'pack',
        `${pkg.name}@${pkg.version}`,
        '--ignore-scripts',
        '--pack-destination',
        join(destination, 'npm'),
      ],
      repository
    );
    assert.equal(
      packed.integrity,
      published.dist.integrity,
      `Registry artifact changed: ${pkg.name}`
    );
    return {
      name: pkg.name,
      version: pkg.version,
      integrity: published.dist.integrity,
      archive: `npm/${packed.filename}`,
      sha256: hashFile(join(destination, 'npm', packed.filename)),
    };
  });
  return { kind: 'npm', label: unit.version, commit, packages };
}

function candidateTarget(repository, destination) {
  const commit = revision(repository, 'HEAD');
  execute('git', ['diff', '--exit-code', 'HEAD', '--', 'packages'], repository);
  assert.equal(
    execute(
      'git',
      ['ls-files', '--others', '--exclude-standard', '--', 'packages'],
      repository
    ).trim(),
    '',
    'Commit candidate package sources before preparing verification'
  );
  const source = manifests(repository, commit);
  mkdirSync(join(destination, 'candidate'), { recursive: true });
  const packages = source.map((pkg) => {
    const directory = join(repository, dirname(pkg.path));
    const current = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    assert.equal(current.version, pkg.version, 'Pack a clean candidate with reviewed versions');
    execute('pnpm', ['pack', '--pack-destination', join(destination, 'candidate')], directory);
    const archive = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    return {
      name: pkg.name,
      version: pkg.version,
      archive: `candidate/${archive}`,
      sha256: hashFile(join(destination, 'candidate', archive)),
    };
  });
  assert(packages.length > 0, 'Candidate contains no public packages');
  return { kind: 'candidate', label: commit, commit, packages };
}

module.exports = { publishedTarget, candidateTarget, previousVersion, selectPreviousVersion };
