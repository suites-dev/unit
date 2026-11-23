const assert = require('node:assert/strict');

const declarationPackages = [
  '@suites/core.unit',
  '@suites/unit',
  '@suites/doubles.jest',
  '@suites/doubles.vitest',
];
const fullCombinations = [
  ['published', []],
  ['core-only', ['@suites/core.unit']],
  ['old-unit', ['@suites/core.unit', '@suites/doubles.jest', '@suites/doubles.vitest']],
  ['old-adapters', ['@suites/core.unit', '@suites/unit']],
  ['aligned', declarationPackages],
];
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

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

function compare(left, right) {
  const core = left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  if (core) return core;
  if (!left.prerelease.length || !right.prerelease.length) {
    return Number(!left.prerelease.length) - Number(!right.prerelease.length);
  }
  for (
    let index = 0;
    index < Math.max(left.prerelease.length, right.prerelease.length);
    index += 1
  ) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return Number(leftIdentifier !== undefined) - Number(rightIdentifier !== undefined);
    }
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) - Number(rightIdentifier);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier.localeCompare(rightIdentifier);
  }
  return 0;
}

function latestStable(versions, major) {
  return versions
    .filter((version) => stableVersionPattern.test(version))
    .map((version) => parseVersion(version, 'Published version'))
    .filter((version) => version.major === major)
    .sort(compare)
    .at(-1);
}

function compatibilityPlan({ candidateVersions, publishedVersions }) {
  const candidates = Object.fromEntries(
    declarationPackages.map((name) => {
      assert(candidateVersions[name], `Missing candidate version for ${name}`);
      return [name, parseVersion(candidateVersions[name], `${name} candidate version`)];
    })
  );
  const candidateMajors = new Set(Object.values(candidates).map(({ major }) => major));
  assert.equal(
    candidateMajors.size,
    1,
    'Declaration-coupled packages must use the same candidate major'
  );
  const candidateMajor = [...candidateMajors][0];

  const latestPublished = Object.fromEntries(
    declarationPackages.map((name) => {
      assert(Array.isArray(publishedVersions[name]), `Missing published versions for ${name}`);
      const stable = publishedVersions[name]
        .filter((version) => stableVersionPattern.test(version))
        .map((version) => parseVersion(version, 'Published version'))
        .sort(compare);
      assert(stable.length > 0, `${name} has no published stable releases`);
      return [name, stable.at(-1)];
    })
  );

  const baselines = Object.fromEntries(
    declarationPackages.flatMap((name) => {
      const version = latestStable(publishedVersions[name], candidateMajor);
      return version ? [[name, version.version]] : [];
    })
  );
  const baselineCount = Object.keys(baselines).length;
  assert(
    baselineCount === 0 || baselineCount === declarationPackages.length,
    'Expected same-major baselines for every declaration-coupled package or none'
  );

  const latestPublishedMajors = new Set(Object.values(latestPublished).map(({ major }) => major));
  assert.equal(
    latestPublishedMajors.size,
    1,
    'Declaration-coupled packages must have the same latest published stable major'
  );
  const latestPublishedMajor = [...latestPublishedMajors][0];
  assert(
    candidateMajor >= latestPublishedMajor,
    `Candidate major ${candidateMajor} is older than the latest published major ${latestPublishedMajor}`
  );
  assert(
    candidateMajor === 4 || candidateMajor === 5,
    `Type compatibility supports candidate majors 4 and 5, received ${candidateMajor}`
  );

  const sameMajor = baselineCount === declarationPackages.length;
  if (sameMajor) {
    for (const name of declarationPackages) {
      assert(
        compare(candidates[name], latestPublished[name]) >= 0,
        `${name} candidate ${candidates[name].version} is older than latest stable ${latestPublished[name].version}`
      );
    }
  } else {
    assert.equal(
      candidateMajor,
      latestPublishedMajor + 1,
      `A first-major compatibility check must advance exactly one major from ${latestPublishedMajor}`
    );
    for (const candidate of Object.values(candidates)) {
      assert(
        candidate.minor === 0 && candidate.patch === 0,
        `A new major must start at ${candidateMajor}.0.0`
      );
    }
  }

  return {
    mode: sameMajor ? 'same-major' : 'first-major',
    candidateMajor,
    fixtureSet: `v${candidateMajor}`,
    compilerProfiles: ['current', '5.2.2'],
    baselines,
    combinations: sameMajor ? fullCombinations : [['aligned', declarationPackages]],
  };
}

module.exports = {
  compatibilityPlan,
  declarationPackages,
};
