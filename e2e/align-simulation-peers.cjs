const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

// Stable peer ranges intentionally exclude prereleases. Only the disposable
// release simulation adds the exact versions it just generated. These edits
// stay in the disposable checkout and never change a published peer contract.
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
assert(branch.startsWith('e2e-'), 'Peer alignment is only for disposable E2E branches');
const files = execFileSync('git', ['ls-files', '-z', 'packages/**/package.json'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
const packages = files.map((file) => ({ file, manifest: JSON.parse(readFileSync(file)) }));
const versions = new Map(
  packages.map(({ manifest }) => {
    assert.match(
      manifest.version,
      /^\d+\.\d+\.\d+-e2e\.\d+$/,
      `${manifest.name} must have a simulated version`
    );
    return [manifest.name, manifest.version];
  })
);
for (const { file, manifest } of packages) {
  let changed = false;
  for (const [name, range] of Object.entries(manifest.peerDependencies || {})) {
    if (!versions.has(name)) continue;
    const version = versions.get(name);
    if (!range.split(' || ').includes(version)) {
      manifest.peerDependencies[name] = `${range} || ${version}`;
      changed = true;
    }
  }
  if (changed) writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}
