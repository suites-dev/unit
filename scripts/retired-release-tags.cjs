const assert = require('node:assert/strict');

// The unpublished 4.2.0 signed tags were retired after their identities were archived:
// https://github.com/suites-dev/unit/pull/1123#issuecomment-7000787014
const retiredTags = new Set([
  '@suites/unit@4.2.0',
  '@suites/core.unit@4.2.0',
  '@suites/doubles.jest@4.2.0',
  '@suites/doubles.vitest@4.2.0',
]);

function assertReleaseTagAvailable(name, version) {
  const tag = `${name}@${version}`;
  assert(!retiredTags.has(tag), `${tag}: retired release name; choose a new version`);
}

module.exports = { assertReleaseTagAvailable };
