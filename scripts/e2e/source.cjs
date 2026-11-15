const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, readdirSync, lstatSync, writeFileSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { execute } = require('./process.cjs');

function revision(repository, ref) {
  assert(ref && !/[\r\n\0]/.test(ref), 'Supply a test/source revision');
  return execute(
    'git',
    ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`],
    repository
  ).trim();
}

function trackedFiles(repository, commit, directory) {
  return execute('git', ['ls-tree', '-r', '--name-only', commit, '--', directory], repository)
    .trim()
    .split('\n')
    .filter(Boolean);
}

function manifests(repository, commit) {
  return trackedFiles(repository, commit, 'packages')
    .filter((file) => /^packages\/(?:[^/]+\/){1,2}package\.json$/.test(file))
    .map((file) => ({
      path: file,
      ...JSON.parse(execute('git', ['show', `${commit}:${file}`], repository)),
    }))
    .filter((manifest) => !manifest.private && manifest.name?.startsWith('@suites/'));
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function filesBelow(directory) {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const file = join(directory, name);
      assert(
        !lstatSync(file).isSymbolicLink(),
        `Test snapshots must not contain symlinks: ${file}`
      );
      return lstatSync(file).isDirectory() ? filesBelow(file) : [file];
    });
}

function snapshot(repository, ref, destination) {
  const commit = revision(repository, ref);
  assert(trackedFiles(repository, commit, 'e2e').length > 0, `No E2E suite at ${commit}`);
  mkdirSync(destination, { recursive: true });
  const archive = join(destination, 'tests.tar');
  writeFileSync(
    archive,
    execute('git', ['archive', commit, 'e2e'], repository, { encoding: null })
  );
  execute('tar', ['-xf', archive, '-C', destination], repository);
  const files = filesBelow(join(destination, 'e2e'));
  const projects = files
    .filter((file) => file.endsWith('/package.json'))
    .flatMap((file) => {
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
      if (!manifest.scripts?.test || !dependencies['@suites/unit']) return [];
      return [relative(join(destination, 'e2e'), resolve(file, '..'))];
    });
  assert(projects.length > 0, 'No consumer E2E projects found in the selected test source');
  const hashes = Object.fromEntries(
    files.map((file) => [relative(destination, file), hashFile(file)])
  );
  return { commit, projects, hashes };
}

function verifySnapshot(directory, hashes, mutablePaths = []) {
  for (const [file, hash] of Object.entries(hashes)) {
    if (!mutablePaths.includes(file))
      assert.equal(hashFile(join(directory, file)), hash, `Test source changed: ${file}`);
  }
}

module.exports = { revision, manifests, snapshot, hashFile, verifySnapshot };
