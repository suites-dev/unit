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

function parseVersion(version, { stable = false } = {}) {
  const pattern = stable ? /^(\d+)\.(\d+)\.(\d+)$/ : /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/;
  const match = pattern.exec(version);
  assert(match, `Invalid ${stable ? 'stable ' : ''}version: ${version}`);
  return match.slice(1).map(Number);
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function latestStable(versions, major) {
  return versions
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .map((version) => ({ raw: version, parsed: parseVersion(version, { stable: true }) }))
    .filter(({ parsed }) => parsed[0] === major)
    .sort((left, right) => compare(left.parsed, right.parsed))
    .at(-1)?.raw;
}

function compatibilityPlan({ candidateVersions, publishedVersions }) {
  const candidateMajors = new Set(
    declarationPackages.map((name) => {
      assert(candidateVersions[name], `Missing candidate version for ${name}`);
      return parseVersion(candidateVersions[name])[0];
    })
  );
  assert.equal(
    candidateMajors.size,
    1,
    'Declaration-coupled packages must use the same candidate major'
  );
  const candidateMajor = [...candidateMajors][0];

  const latestPublishedMajor = Math.max(
    ...declarationPackages.flatMap((name) => {
      assert(Array.isArray(publishedVersions[name]), `Missing published versions for ${name}`);
      return publishedVersions[name]
        .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
        .map((version) => parseVersion(version, { stable: true })[0]);
    })
  );
  assert(
    candidateMajor >= latestPublishedMajor,
    `Candidate major ${candidateMajor} is older than the latest published major ${latestPublishedMajor}`
  );
  assert(
    candidateMajor === 4 || candidateMajor === 5,
    `Type compatibility supports candidate majors 4 and 5, received ${candidateMajor}`
  );

  const baselines = Object.fromEntries(
    declarationPackages.flatMap((name) => {
      const version = latestStable(publishedVersions[name], candidateMajor);
      return version ? [[name, version]] : [];
    })
  );
  const baselineCount = Object.keys(baselines).length;
  assert(
    baselineCount === 0 || baselineCount === declarationPackages.length,
    'Expected same-major baselines for every declaration-coupled package or none'
  );

  const sameMajor = baselineCount === declarationPackages.length;
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
