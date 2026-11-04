const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

test('finalization pushes immutable tags to a local remote and can resume missing GitHub Releases', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'suites-finalize-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'),
    remote = join(root, 'remote.git'),
    bin = join(root, 'bin');
  mkdirSync(repo);
  mkdirSync(bin);
  const git = (...args) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '--initial-branch=master');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  mkdirSync(join(repo, 'packages/unit'), { recursive: true });
  writeFileSync(
    join(repo, 'packages/unit/CHANGELOG.md'),
    '# [4.0.0](url) (date)\n\n### BREAKING CHANGES\n\nNode 22 minimum\n'
  );
  git('add', '.');
  git('commit', '-m', 'release');
  const commit = git('rev-parse', 'HEAD');
  git('push', 'origin', 'master');
  const tag = '@suites/unit@4.0.0';
  const planFile = join(root, 'plan.json');
  writeFileSync(
    planFile,
    JSON.stringify([
      {
        name: '@suites/unit',
        version: '4.0.0',
        packagePath: 'packages/unit',
        tag,
        gitHead: commit,
        disposition: 'publish',
      },
    ])
  );
  const state = join(root, 'release.json');
  // Only the GitHub API boundary is faked. Git fetch, annotated tags and atomic pushes are real.
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const state = process.env.RELEASE_TEST_STATE;
if (process.argv[2] === 'api') {
  if (fs.existsSync(state)) console.log(fs.readFileSync(state, 'utf8'));
  else { console.error('gh: Not Found (HTTP 404)'); process.exitCode = 1; }
} else if (process.argv[2] === 'release' && process.argv[3] === 'create') {
  const notes = fs.readFileSync(0, 'utf8');
  fs.writeFileSync(state, JSON.stringify({ tag_name: process.argv[4], draft: false, prerelease: false, body: notes }));
} else { console.error('Unexpected gh command'); process.exitCode = 1; }
`,
    { mode: 0o755 }
  );
  const run = () =>
    execFileSync(
      process.execPath,
      [resolve(__dirname, 'release-publication.cjs'), 'finalize', planFile],
      {
        cwd: repo,
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          APPROVED_COMMIT: commit,
          GITHUB_REPOSITORY: 'test/unit',
          RELEASE_TEST_STATE: state,
        },
      }
    );
  run();
  assert.equal(git('rev-parse', `refs/tags/${tag}^{commit}`), commit);
  const remoteTag = git('ls-remote', 'origin', `refs/tags/${tag}`);
  assert(remoteTag);
  assert.match(JSON.parse(readFileSync(state)).body, /Node 22 minimum/);
  rmSync(state); // npm and tags succeeded, GitHub Release needs completing on a retry.
  run();
  assert.equal(git('ls-remote', 'origin', `refs/tags/${tag}`), remoteTag);
  assert.equal(JSON.parse(readFileSync(state)).tag_name, tag);
  run(); // Already-complete release is also idempotent.
  assert.equal(git('ls-remote', 'origin', `refs/tags/${tag}`), remoteTag);

  writeFileSync(join(repo, 'packages/unit/CHANGELOG.md'), '# changed without a version bump');
  git('add', '.');
  git('commit', '-m', 'change');
  const changedCommit = git('rev-parse', 'HEAD');
  writeFileSync(
    planFile,
    JSON.stringify([
      {
        name: '@suites/unit',
        version: '4.0.0',
        packagePath: 'packages/unit',
        tag,
        gitHead: changedCommit,
        disposition: 'preserve',
      },
    ])
  );
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [resolve(__dirname, 'release-publication.cjs'), 'finalize', planFile],
      {
        cwd: repo,
        stdio: 'pipe',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APPROVED_COMMIT: changedCommit },
      }
    )
  );
  assert.equal(git('ls-remote', 'origin', `refs/tags/${tag}`), remoteTag);
});
