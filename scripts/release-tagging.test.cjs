const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { tagPlan } = require('./release-tagging.cjs');

test('tag plans use reviewed package versions without registry access and preserve unchanged independent tags', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'suites-tag-plan-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const original = process.cwd();
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '--initial-branch=master');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  const location = join(root, 'packages/unit');
  mkdirSync(location, { recursive: true });
  const pkg = { name: '@suites/unit', version: '4.0.0', location, private: false };
  writeFileSync(join(location, 'package.json'), JSON.stringify(pkg));
  writeFileSync(join(location, 'CHANGELOG.md'), '# [4.0.0](url) (date)\n\nRelease notes\n');
  git('add', '.');
  git('commit', '-m', 'release');
  const commit = git('rev-parse', 'HEAD');
  try {
    process.chdir(root);
    const [first] = tagPlan([pkg], commit);
    assert.equal(first.tag, '@suites/unit@4.0.0');
    assert.equal(first.gitHead, commit);
    git('-c', 'tag.gpgSign=false', 'tag', first.tag);
    git('commit', '--allow-empty', '-m', 'unrelated');
    const second = git('rev-parse', 'HEAD');
    assert.equal(tagPlan([pkg], second)[0].gitHead, commit);
    assert.throws(() => tagPlan([{ ...pkg, version: '4.1.0-next.0' }], second), /stable versions/);
    writeFileSync(join(location, 'CHANGELOG.md'), 'changed without version');
    git('add', '.');
    git('commit', '-m', 'changed');
    assert.throws(() => tagPlan([pkg], git('rev-parse', 'HEAD')));
  } finally {
    process.chdir(original);
  }
});
