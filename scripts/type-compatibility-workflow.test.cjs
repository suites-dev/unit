const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

test('Build 26 simulates conventional candidate versions before compatibility checking', () => {
  const workflow = readFileSync(join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const checkout = workflow.indexOf('fetch-depth: 0');
  const simulation = workflow.indexOf('Create local compatibility branch');
  const versioning = workflow.indexOf('Version packages for type compatibility');
  const build = workflow.indexOf('- name: Build');
  const compatibility = workflow.indexOf('- name: Check published and candidate type compatibility');

  assert.ok(checkout >= 0, 'CI checkout must include release history and tags');
  assert.ok(simulation > checkout, 'CI must create an isolated local simulation branch');
  assert.ok(versioning > simulation, 'CI must calculate conventional candidate versions');
  assert.ok(build > versioning, 'candidate versions must be prepared before packages are built');
  assert.ok(compatibility > build, 'compatibility must inspect the built, versioned candidates');
  assert.match(workflow, /--conventional-commits/);
  assert.match(workflow, /--conventional-prerelease/);
  assert.match(workflow, /--no-git-tag-version/);
  assert.match(workflow, /--no-push/);
});
