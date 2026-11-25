const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const preset = require('./changelog-preset.cjs');

async function repositoryFixture(t) {
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
        repository: {
          type: 'git',
          url: 'https://github.com/suites-dev/unit.git',
          directory: `packages/${scope}`,
        },
      })
    );
  const commit = (message) => {
    git('add', '.');
    git('commit', '-m', message);
  };
  const generate = async (scope, version) => {
    manifest(scope, version);
    const generator = new ConventionalChangelog(paths[scope]);
    generator.config(await preset({ cwd: root }));
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
  return { git, commit, generate, scopes, paths, manifest };
}

test('package changelogs retain breaking changes through graduation and reset after stable', async (t) => {
  const { git, commit, generate, scopes, paths, manifest } = await repositoryFixture(t);
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

test('use a maintenance release restoration only for the package whose entire tree matches', async (t) => {
  const { git, commit, generate, scopes, paths, manifest } = await repositoryFixture(t);
  git('switch', '-c', 'maintenance');
  for (const scope of scopes) manifest(scope, '3.1.1');
  commit('chore: release from maintenance');
  for (const scope of scopes) git('tag', `@suites/${scope}@3.1.1`);

  git('switch', 'next');
  writeFileSync(join(paths.unit, 'preview.js'), 'preview');
  commit('feat(unit): offer preview API');
  writeFileSync(join(paths['di.inversify'], 'fix.js'), 'fix');
  commit('fix(di.inversify): retain qualified providers');
  git('merge', '--no-ff', 'maintenance', '-m', 'Merge published maintenance release');

  git('switch', '-c', 'independent');
  writeFileSync(join(paths.unit, 'independent.js'), 'independent');
  commit('feat(unit): support an independent provider');

  git('switch', 'next');
  git('switch', '-c', 'restore');
  git('rm', 'packages/unit/preview.js');
  commit('revert(unit): defer preview API');
  git('switch', 'next');
  git('merge', '--no-ff', 'restore', '-m', 'Merge rollback');
  git('merge', '--no-ff', 'independent', '-m', 'Merge independent provider');
  writeFileSync(join(paths.unit, 'public.js'), 'public');
  commit('feat(unit): offer stable API');

  const unit = await generate('unit', '4.0.0');
  assert.doesNotMatch(unit, /offer preview API|defer preview API/);
  assert.match(unit, /support an independent provider/);
  assert.match(unit, /offer stable API/);
  assert.match(decodeURIComponent(unit), /@suites\/unit@3\.1\.1\.\.\.@suites\/unit@4\.0\.0/);
  const inversify = await generate('di.inversify', '4.0.0');
  assert.match(inversify, /retain qualified providers/);
});

test('Git reverts remove withdrawn features from the next stable changelog', async (t) => {
  const { git, commit, generate, paths } = await repositoryFixture(t);
  git('tag', '@suites/unit@3.1.0');
  writeFileSync(join(paths.unit, 'preview.js'), 'preview');
  commit('feat(unit): add a preview provider');
  git('revert', '--no-edit', 'HEAD');
  writeFileSync(join(paths.unit, 'stable.js'), 'stable');
  commit('feat(unit): add a stable provider');

  const notes = await generate('unit', '3.2.0');
  assert.match(notes, /add a stable provider/);
  assert.doesNotMatch(notes, /preview provider|### Reverts/);
});
