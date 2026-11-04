const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

function fixture(t) {
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
  const key = join(root, 'key'),
    allowed = join(root, 'allowed_signers');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key]);
  writeFileSync(allowed, `release@example.invalid ${readFileSync(`${key}.pub`, 'utf8')}`);
  git('config', 'gpg.format', 'ssh');
  git('config', 'user.signingkey', key);
  git('config', 'gpg.ssh.allowedSignersFile', allowed);
  for (const pkg of ['unit', 'core']) {
    mkdirSync(join(repo, `packages/${pkg}`), { recursive: true });
    writeFileSync(
      join(repo, `packages/${pkg}/CHANGELOG.md`),
      '# [4.0.0](url) (date)\n\n### BREAKING CHANGES\n\nNode 22 minimum\n'
    );
  }
  git('add', '.');
  git('commit', '-m', 'release');
  const commit = git('rev-parse', 'HEAD');
  git('push', 'origin', 'master');
  const plan = ['unit', 'core'].map((pkg) => ({
    name: `@suites/${pkg}`,
    version: '4.0.0',
    packagePath: `packages/${pkg}`,
    tag: `@suites/${pkg}@4.0.0`,
    gitHead: commit,
    disposition: 'publish',
  }));
  const planFile = join(root, 'plan.json'),
    state = join(root, 'releases.json'),
    reject = join(root, 'reject');
  writeFileSync(planFile, JSON.stringify(plan));
  // Only GitHub is faked. Signing, signature verification, Git transport and immutable tag checks are real.
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs'), cp = require('node:child_process');
const state = process.env.RELEASE_TEST_STATE;
const releases = fs.existsSync(state) ? JSON.parse(fs.readFileSync(state)) : {};
const args = process.argv.slice(2);
const git = (...args) => cp.execFileSync('git', args, {encoding:'utf8', stdio:'pipe'}).trim();
if (args[0] === 'api') {
  const route = args[1];
  if (route.includes('/git/ref/tags/')) {
    const tag = decodeURIComponent(route.split('/git/ref/tags/')[1]);
    const line = git('ls-remote', 'origin', 'refs/tags/' + tag);
    if (!line) { console.error('gh: Not Found (HTTP 404)'); process.exit(1); }
    const sha = line.split(/\\s+/)[0];
    console.log(JSON.stringify({object: {type:git('cat-file','-t',sha), sha}}));
  } else if (route.includes('/git/tags/')) {
    const sha = route.split('/git/tags/')[1];
    const raw = git('cat-file','-p',sha);
    const tag = raw.match(/^tag (.+)$/m)[1];
    const target = raw.match(/^object (.+)$/m)[1];
    const verified = !fs.existsSync(process.env.RELEASE_TEST_REJECT) && cp.spawnSync('git',['verify-tag',sha]).status === 0;
    console.log(JSON.stringify({tag, object:{type:'commit',sha:target}, verification:{verified, reason:verified?'valid':'invalid'}}));
  } else {
    const tag = decodeURIComponent(route.split('/releases/tags/')[1]);
    if (releases[tag]) console.log(JSON.stringify(releases[tag]));
    else { console.error('gh: Not Found (HTTP 404)'); process.exit(1); }
  }
} else if (args[0] === 'release' && args[1] === 'create') {
  releases[args[2]] = {tag_name:args[2],draft:false,prerelease:false,body:fs.readFileSync(0,'utf8'),latest:args.includes('--latest=true')};
  fs.writeFileSync(state,JSON.stringify(releases));
} else { console.error('Unexpected gh command'); process.exit(1); }
`,
    { mode: 0o755 }
  );
  const run = (extra = {}) =>
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
          OVERALL_RELEASE_TAG: 'v4.0.0',
          RELEASE_TEST_STATE: state,
          RELEASE_TEST_REJECT: reject,
          ...extra,
        },
      }
    );
  return { root, repo, git, run, commit, plan, planFile, state, reject };
}

test('signed package tags precede the signed overall release, and partial releases resume without moving tags', (t) => {
  const f = fixture(t);
  f.run();
  const tags = [...f.plan.map((p) => p.tag), 'v4.0.0'];
  const before = f.git('ls-remote', 'origin', 'refs/tags/*');
  for (const tag of tags) {
    assert.equal(f.git('rev-parse', `refs/tags/${tag}^{commit}`), f.commit);
    assert.doesNotThrow(() => f.git('verify-tag', tag));
  }
  const releases = JSON.parse(readFileSync(f.state));
  assert.deepEqual(Object.keys(releases), tags);
  assert.equal(releases['v4.0.0'].latest, true);
  assert.match(releases['v4.0.0'].body, /Node 22 minimum/);
  assert.equal(releases[f.plan[0].tag].latest, false);
  delete releases['v4.0.0'];
  writeFileSync(f.state, JSON.stringify(releases));
  f.run();
  f.run();
  assert.equal(f.git('ls-remote', 'origin', 'refs/tags/*'), before);
  assert(JSON.parse(readFileSync(f.state))['v4.0.0']);
});

test('GitHub signature rejection stops before the overall tag and can resume after verification succeeds', (t) => {
  const f = fixture(t);
  writeFileSync(f.reject, 'reject');
  assert.throws(() => f.run(), /signature is not verified/);
  assert.equal(f.git('ls-remote', 'origin', 'refs/tags/v4.0.0'), '');
  assert.equal(existsSync(f.state), false);
  rmSync(f.reject);
  f.run();
  assert(f.git('ls-remote', 'origin', 'refs/tags/v4.0.0'));
});

test('unsigned existing package tags are rejected without creating an overall tag', (t) => {
  const f = fixture(t),
    tag = f.plan[0].tag;
  f.git('-c', 'tag.gpgSign=false', 'tag', '-a', tag, '-m', 'unsigned');
  f.git('push', 'origin', `refs/tags/${tag}`);
  assert.throws(() => f.run(), /signature is not verified/);
  assert.equal(f.git('ls-remote', 'origin', 'refs/tags/v4.0.0'), '');
});

test('invalid overall versions and existing wrong-commit overall tags fail before publication finalization', (t) => {
  const f = fixture(t);
  assert.throws(() => f.run({ OVERALL_RELEASE_TAG: 'v5.0.0' }), /must match/);
  assert.equal(f.git('ls-remote', 'origin', 'refs/tags/*'), '');
  f.git('commit', '--allow-empty', '-m', 'later');
  f.git('tag', '-s', 'v4.0.0', '-m', 'wrong commit');
  f.git('push', 'origin', 'refs/tags/v4.0.0');
  f.git('checkout', '--detach', f.commit);
  assert.throws(() => f.run(), /Overall tag collision/);
});

test('package-only release works without an overall tag', (t) => {
  const f = fixture(t);
  f.run({ OVERALL_RELEASE_TAG: '' });
  assert.equal(f.git('ls-remote', 'origin', 'refs/tags/v4.0.0'), '');
  assert.equal(Object.keys(JSON.parse(readFileSync(f.state))).length, 2);
});

test('a changed package cannot reuse an existing release tag', (t) => {
  const f = fixture(t);
  f.run();
  writeFileSync(join(f.repo, 'packages/unit/CHANGELOG.md'), 'changed');
  f.git('add', '.');
  f.git('commit', '-m', 'changed');
  const commit = f.git('rev-parse', 'HEAD');
  writeFileSync(f.planFile, JSON.stringify(f.plan.map((p) => ({ ...p, gitHead: commit }))));
  assert.throws(() => f.run({ APPROVED_COMMIT: commit, OVERALL_RELEASE_TAG: '' }));
  assert.equal(f.git('rev-parse', `${f.plan[0].tag}^{commit}`), f.commit);
});
