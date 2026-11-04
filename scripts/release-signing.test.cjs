const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'suites-signing-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'),
    bin = join(root, 'bin'),
    key = join(root, 'key');
  mkdirSync(repo);
  mkdirSync(bin);
  execFileSync('git', ['init'], { cwd: repo, stdio: 'pipe' });
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key]);
  const publicKey = readFileSync(`${key}.pub`, 'utf8');
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const route = process.argv.at(-1);
console.log(JSON.stringify(route.endsWith('/ssh_signing_keys') ?
  [process.env.UNREGISTERED ? [] : [{key:process.env.RELEASE_SIGNING_PUBLIC_KEY}]] :
  [{login:'release-test',id:123,name:'Release Test'}]));
`,
    { mode: 0o755 }
  );
  const run = (extra = {}) =>
    execFileSync(process.execPath, [resolve(__dirname, 'configure-release-signing.cjs')], {
      cwd: repo,
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        RUNNER_TEMP: root,
        RELEASE_SIGNING_PRIVATE_KEY: readFileSync(key, 'utf8'),
        RELEASE_SIGNING_PUBLIC_KEY: publicKey,
        RELEASE_SIGNING_LOGIN: 'release-test',
        ...extra,
      },
    });
  return { root, repo, key, run };
}

test('signing setup verifies a registered key pair and creates a verifiable Git tag', (t) => {
  const f = setup(t);
  f.run();
  const git = (...args) =>
    execFileSync('git', args, { cwd: f.repo, stdio: 'pipe', encoding: 'utf8' }).trim();
  git('-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'test');
  git('tag', '-s', 'v1.0.0', '-m', 'test');
  assert.doesNotThrow(() => git('verify-tag', 'v1.0.0'));
  assert.equal(git('config', 'user.email'), '123+release-test@users.noreply.github.com');
});

test('unregistered signing keys fail before writing the runner private key', (t) => {
  const f = setup(t);
  assert.throws(() => f.run({ UNREGISTERED: '1' }), /not registered/);
  assert.equal(existsSync(join(f.root, 'suites-release-signing/key')), false);
});

test('mismatched public and private keys fail before Git signing is configured', (t) => {
  const f = setup(t),
    other = join(f.root, 'other');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', other]);
  assert.throws(
    () => f.run({ RELEASE_SIGNING_PUBLIC_KEY: readFileSync(`${other}.pub`, 'utf8') }),
    /key pair mismatch/
  );
});
