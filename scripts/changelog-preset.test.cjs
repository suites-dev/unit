const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const preset = require('./changelog-preset.cjs');

test('package changelogs retain breaking changes through graduation and reset after stable', async (t) => {
  const { ConventionalChangelog, packagePrefix } = await import('conventional-changelog');
  const root = mkdtempSync(join(tmpdir(), 'suites-changelog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  const scopes = ['unit', 'di.inversify'];
  const paths = Object.fromEntries(scopes.map((scope) => [scope, join(root, 'packages', scope)]));
  const manifest = (scope, version) =>
    writeFileSync(
      join(paths[scope], 'package.json'),
      JSON.stringify({
        name: `@suites/${scope}`,
        version,
        repository: { type: 'git', url: 'https://github.com/suites-dev/unit.git' },
      })
    );
  const commit = (message) => {
    git('add', '.');
    git('commit', '-m', message);
  };
  const generate = async (scope, version) => {
    manifest(scope, version);
    const generator = new ConventionalChangelog(paths[scope]);
    generator.config(await preset());
    generator.readPackage(join(paths[scope], 'package.json'));
    generator.commits({ path: paths[scope] });
    generator.tags({ prefix: packagePrefix(`@suites/${scope}`) });
    let result = '';
    for await (const chunk of generator.writeStream()) result += chunk;
    return result;
  };

  git('init', '--initial-branch=next');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release-test@example.invalid');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'commit.gpgsign', 'false');
  for (const scope of scopes) {
    mkdirSync(paths[scope], { recursive: true });
    manifest(scope, '3.1.0');
  }
  commit('chore: initial stable release');
  for (const scope of scopes) git('tag', `@suites/${scope}@3.1.0`);

  for (const scope of scopes) {
    manifest(scope, '4.0.0-next.0');
    commit(
      `feat(${scope}): support maintained Node releases\n\nBREAKING CHANGE: ${scope} requires Node 22 or later. Use \`@named(value)\` for named injections.`
    );
  }
  for (const scope of scopes) {
    const prerelease = await generate(scope, '4.0.0-next.1');
    assert.match(prerelease, /### BREAKING CHANGES/);
    assert.ok(prerelease.includes(`**${scope}:** ${scope} requires Node 22`));
  }
  commit('chore: version prerelease packages');
  for (const scope of scopes) git('tag', `@suites/${scope}@4.0.0-next.1`);

  writeFileSync(join(paths.unit, 'fix.js'), '// Fix discovered during prerelease testing.\n');
  commit('fix(unit): handle a prerelease regression');
  for (const scope of scopes) {
    const stable = await generate(scope, '4.0.0');
    assert.match(stable, /# \[4\.0\.0\]/);
    assert.match(stable, /### BREAKING CHANGES/);
    assert.ok(stable.includes(`**${scope}:** ${scope} requires Node 22`));
    assert.ok(stable.includes('`@named(value)`'));
    assert.ok(!stable.includes('github.com/named'));
    assert.ok(!stable.includes('4.0.0-next.1'));
    const otherScope = scopes.find((other) => other !== scope);
    assert.ok(!stable.includes(`**${otherScope}:**`));
    assert.equal(stable.includes('handle a prerelease regression'), scope === 'unit');
  }
  commit('chore: graduate packages to stable');
  for (const scope of scopes) git('tag', `@suites/${scope}@4.0.0`);

  writeFileSync(join(paths.unit, 'fix.js'), '// Subsequent stable patch.\n');
  commit('fix(unit): handle a stable regression');
  const patch = await generate('unit', '4.0.1');
  assert.match(patch, /handle a stable regression/);
  assert.doesNotMatch(patch, /BREAKING CHANGES|maintained Node releases|prerelease regression/);
});
