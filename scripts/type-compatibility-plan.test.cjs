const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compatibilityPlan } = require('./type-compatibility-plan.cjs');

const packages = [
  '@suites/core.unit',
  '@suites/unit',
  '@suites/doubles.jest',
  '@suites/doubles.vitest',
];
const versions = (version) => Object.fromEntries(packages.map((name) => [name, version]));
const published = (...available) => Object.fromEntries(packages.map((name) => [name, available]));
const combinations = [
  ['published', []],
  ['core-only', ['@suites/core.unit']],
  ['old-unit', ['@suites/core.unit', '@suites/doubles.jest', '@suites/doubles.vitest']],
  ['old-adapters', ['@suites/core.unit', '@suites/unit']],
  ['aligned', packages],
];

test('major 4 candidates retain every published and mixed-package compatibility gate', () => {
  assert.deepEqual(
    compatibilityPlan({
      candidateVersions: versions('4.1.4-next.0'),
      publishedVersions: published('3.1.1', '4.1.2', '4.1.3', '5.0.0-beta.1'),
    }),
    {
      mode: 'same-major',
      candidateMajor: 4,
      fixtureSet: 'v4',
      compilerProfiles: ['current', '5.2.2'],
      baselines: versions('4.1.3'),
      combinations,
    }
  );
});

test('a first V5 candidate compiles aligned V5 declarations without a cross-major baseline', () => {
  assert.deepEqual(
    compatibilityPlan({
      candidateVersions: versions('5.0.0-next.0'),
      publishedVersions: published('3.1.1', '4.1.3', '5.0.0-beta.1'),
    }),
    {
      mode: 'first-major',
      candidateMajor: 5,
      fixtureSet: 'v5',
      compilerProfiles: ['current', '5.2.2'],
      baselines: {},
      combinations: [['aligned', packages]],
    }
  );
});

test('V5 patch and minor candidates restore the full matrix against published V5', () => {
  assert.deepEqual(
    compatibilityPlan({
      candidateVersions: versions('5.1.0-next.0'),
      publishedVersions: published('4.1.3', '5.0.0', '5.0.1', '5.1.0-beta.1'),
    }),
    {
      mode: 'same-major',
      candidateMajor: 5,
      fixtureSet: 'v5',
      compilerProfiles: ['current', '5.2.2'],
      baselines: versions('5.0.1'),
      combinations,
    }
  );
});

test('compatibility planning fails closed for inconsistent candidate package majors', () => {
  const candidateVersions = versions('5.0.0-next.0');
  candidateVersions['@suites/doubles.vitest'] = '4.2.0-next.0';

  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions,
        publishedVersions: published('4.1.3'),
      }),
    /same candidate major/
  );
});

test('compatibility planning fails closed when only some packages have a same-major baseline', () => {
  const publishedVersions = published('4.1.3');
  publishedVersions['@suites/core.unit'] = ['4.1.3', '5.0.0'];

  assert.throws(
    () => compatibilityPlan({ candidateVersions: versions('5.1.0'), publishedVersions }),
    /same-major baselines for every declaration-coupled package or none/
  );
});

test('compatibility planning rejects older and unsupported future candidate majors', () => {
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('3.2.0'),
        publishedVersions: published('4.1.3'),
      }),
    /older than the latest published major 4/
  );
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('6.0.0-next.0'),
        publishedVersions: published('5.0.0'),
      }),
    /supports candidate majors 4 and 5/
  );
});

test('compatibility planning requires published stable history', () => {
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('5.0.0-next.0'),
        publishedVersions: published('5.0.0-next.1'),
      }),
    /no published stable releases/
  );
});

test('a first-major candidate advances exactly one major and starts at zero', () => {
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('5.0.0-next.0'),
        publishedVersions: published('3.9.0'),
      }),
    /advance exactly one major from 3/
  );
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('5.1.0-next.0'),
        publishedVersions: published('4.1.3'),
      }),
    /start at 5\.0\.0/
  );
});

test('same-major candidates cannot predate the latest stable release', () => {
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('4.1.2-next.0'),
        publishedVersions: published('4.1.3'),
      }),
    /candidate 4\.1\.2-next\.0 is older than latest stable 4\.1\.3/
  );
});

test('candidate versions use strict exact semver', () => {
  assert.throws(
    () =>
      compatibilityPlan({
        candidateVersions: versions('5.0.0-next.01'),
        publishedVersions: published('4.1.3'),
      }),
    /valid exact semver/
  );
});
