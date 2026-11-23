const assert = require('node:assert/strict');
const { mkdirSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { execute, npmRegistry, registryPackage, registryVersions } = require('./process.cjs');
const { revision, manifests, hashFile } = require('./source.cjs');

const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const majorReleaseGroup = [
  '@suites/core.unit',
  '@suites/doubles.jest',
  '@suites/doubles.vitest',
  '@suites/unit',
];

function parseVersion(version, description = 'Version') {
  assert(
    typeof version === 'string' && versionPattern.test(version),
    `${description} must be valid exact semver`
  );
  const separator = version.indexOf('-');
  const base = separator < 0 ? version : version.slice(0, separator);
  const prerelease = separator < 0 ? [] : version.slice(separator + 1).split('.');
  assert(
    prerelease.every((identifier) => !/^\d+$/.test(identifier) || !/^0\d/.test(identifier)),
    `${description} must be valid exact semver`
  );
  const [major, minor, patch] = base.split('.').map(Number);
  return { version, major, minor, patch, prerelease };
}

function compareVersions(left, right) {
  const core = left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  if (core) return core;
  if (!left.prerelease.length || !right.prerelease.length)
    return Number(!left.prerelease.length) - Number(!right.prerelease.length);
  for (
    let index = 0;
    index < Math.max(left.prerelease.length, right.prerelease.length);
    index += 1
  ) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined)
      return Number(leftIdentifier !== undefined) - Number(rightIdentifier !== undefined);
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) - Number(rightIdentifier);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier.localeCompare(rightIdentifier);
  }
  return 0;
}

function selectPreviousVersion(versions, candidateVersion) {
  const candidate = parseVersion(candidateVersion, 'Candidate version');
  const eligible = versions
    .filter((version) => stableVersionPattern.test(version))
    .map((version) => parseVersion(version, 'Published version'))
    .filter(
      (version) => version.major === candidate.major && compareVersions(version, candidate) <= 0
    )
    .sort(compareVersions);
  return eligible.at(-1)?.version;
}

function candidateVersion(packages) {
  assert(packages.length > 0, 'Candidate contains no public packages');
  const parsed = packages.map((pkg) => ({
    name: pkg.name,
    ...parseVersion(pkg.version, `${pkg.name} candidate version`),
  }));
  const unit = parsed.find((pkg) => pkg.name === '@suites/unit');
  assert(unit, 'Candidate contains no @suites/unit package');
  const releaseGroup = majorReleaseGroup.map((name) => {
    const pkg = parsed.find((candidate) => candidate.name === name);
    assert(pkg, `Candidate contains no ${name} package`);
    return pkg;
  });
  const inconsistent = releaseGroup.filter((pkg) => pkg.major !== unit.major);
  assert.equal(
    inconsistent.length,
    0,
    `Candidate major release group must use the same major as @suites/unit ${unit.major}: ${inconsistent
      .map((pkg) => `${pkg.name}@${pkg.version}`)
      .join(', ')}`
  );
  return unit;
}

function automaticCompatibility(versions, packages) {
  const candidate = candidateVersion(packages);
  const stable = versions
    .filter((version) => stableVersionPattern.test(version))
    .map((version) => parseVersion(version, 'Published version'))
    .sort(compareVersions);
  assert(stable.length > 0, 'Registry returned no stable releases; refusing to skip compatibility');
  const latest = stable.at(-1);
  if (candidate.major < latest.major)
    assert.fail(
      `Candidate major ${candidate.major} is older than the latest stable major ${latest.major}`
    );
  if (candidate.major === latest.major) {
    assert(
      compareVersions(candidate, latest) >= 0,
      `Candidate ${candidate.version} is older than latest stable ${latest.version}`
    );
    return {
      status: 'checked',
      baselineVersion: selectPreviousVersion(versions, candidate.version),
      candidateMajor: candidate.major,
      latestStableVersion: latest.version,
    };
  }
  assert.equal(
    candidate.major,
    latest.major + 1,
    `A new-major compatibility skip must advance exactly one major from ${latest.major}`
  );
  assert(
    candidate.minor === 0 && candidate.patch === 0,
    `A new major must start at ${candidate.major}.0.0`
  );
  return {
    status: 'skipped-new-major',
    candidateMajor: candidate.major,
    previousMajor: latest.major,
    latestStableVersion: latest.version,
  };
}

function previousCompatibility(repository, packages) {
  return automaticCompatibility(registryVersions(repository), packages);
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
  candidateVersion(source);
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

module.exports = {
  automaticCompatibility,
  publishedTarget,
  candidateTarget,
  previousCompatibility,
  selectPreviousVersion,
};
