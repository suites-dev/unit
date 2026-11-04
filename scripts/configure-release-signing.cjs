const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

// The private key is scoped to the protected release environment, never an authentication key.
const {
  RELEASE_SIGNING_PRIVATE_KEY: privateKey,
  RELEASE_SIGNING_PUBLIC_KEY: publicKey,
  RELEASE_SIGNING_LOGIN: login,
  RUNNER_TEMP: temporary,
} = process.env;
assert(
  privateKey && publicKey && login && temporary,
  'Release signing configuration is incomplete'
);
assert.match(login, /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i);
const keyParts = publicKey.trim().split(/\s+/);
assert.equal(keyParts[0], 'ssh-ed25519');
assert.match(keyParts[1], /^[A-Za-z\d+/]+=*$/);
const normalized = keyParts.slice(0, 2).join(' ');
const gh = (route) =>
  JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', route], { encoding: 'utf8' }));
const [account] = gh(`users/${login}`);
assert.equal(account.login.toLowerCase(), login.toLowerCase());
const registered = gh(`users/${login}/ssh_signing_keys`).flat();
assert(
  registered.some(({ key }) => key.trim().split(/\s+/).slice(0, 2).join(' ') === normalized),
  'Release public key is not registered as a GitHub signing key'
);
const directory = join(temporary, 'suites-release-signing');
mkdirSync(directory, { mode: 0o700 });
const keyPath = join(directory, 'key');
writeFileSync(keyPath, privateKey.trim() + '\n', { mode: 0o600 });
const derived = execFileSync('ssh-keygen', ['-y', '-P', '', '-f', keyPath], {
  encoding: 'utf8',
}).trim();
assert.equal(derived.split(/\s+/).slice(0, 2).join(' '), normalized, 'Signing key pair mismatch');
const email = `${account.id}+${account.login}@users.noreply.github.com`;
const allowed = join(directory, 'allowed_signers');
writeFileSync(allowed, `${email} ${normalized}\n`, { mode: 0o600 });
// Prove the runner can sign and verify before uploading any package.
const probe = join(directory, 'probe');
writeFileSync(probe, 'Suites release signing preflight\n');
execFileSync('ssh-keygen', ['-Y', 'sign', '-f', keyPath, '-n', 'git', probe], { stdio: 'pipe' });
execFileSync(
  'ssh-keygen',
  ['-Y', 'verify', '-f', allowed, '-I', email, '-n', 'git', '-s', `${probe}.sig`],
  { input: readFileSync(probe), stdio: ['pipe', 'pipe', 'pipe'] }
);
for (const [name, value] of Object.entries({
  'user.name': account.name || account.login,
  'user.email': email,
  'gpg.format': 'ssh',
  'user.signingkey': keyPath,
  'gpg.ssh.allowedSignersFile': allowed,
  'tag.gpgSign': 'true',
}))
  execFileSync('git', ['config', '--local', name, value]);
console.log(`Release tag signer verified: ${account.login}; Release Bot remains the publisher.`);
