const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const { relative, resolve } = require('node:path');
const {
  assertSamePackage,
  releaseNotes,
  githubTag,
  checkTags,
  verifyTags,
} = require('./release-publication.cjs');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();
const hasTag = (tag) =>
  spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`]).status === 0;

function tagPlan(packages, commit) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert(packages.length > 0, 'Lerna found no public packages');
  return packages.map(({ name, version, location, private: isPrivate }) => {
    assert.equal(isPrivate, false);
    assert.match(name, /^@suites\/[a-z][a-z.\d-]*$/);
    assert.match(
      version,
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
      `${name}: tag only reviewed stable versions`
    );
    const packagePath = relative(process.cwd(), location);
    assert(packagePath.startsWith('packages/') && !packagePath.split('/').includes('..'));
    const manifest = JSON.parse(readFileSync(resolve(location, 'package.json')));
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, version);
    releaseNotes(readFileSync(resolve(location, 'CHANGELOG.md'), 'utf8'), version);
    const tag = `${name}@${version}`;
    const gitHead = hasTag(tag) ? git('rev-parse', `refs/tags/${tag}^{commit}`) : commit;
    assertSamePackage(gitHead, commit, packagePath);
    return { name, version, packagePath, tag, gitHead };
  });
}

function pushSignedTags(items) {
  for (const item of items) {
    git('tag', '-s', item.tag, item.gitHead, '-m', `Release ${item.tag}`);
    git('verify-tag', item.tag);
  }
  if (items.length)
    git(
      '-c',
      'push.followTags=false',
      '-c',
      'credential.helper=',
      '-c',
      'credential.helper=!gh auth git-credential',
      'push',
      '--atomic',
      'origin',
      ...items.map((item) => `refs/tags/${item.tag}`)
    );
}

function createTags(plan, commit) {
  assert.equal(git('rev-parse', 'HEAD'), commit);
  git('diff', '--exit-code');
  git('diff', '--cached', '--exit-code');
  // Refresh remote tags before creating anything; a conflict is never force-updated.
  git('fetch', 'origin', '--tags');
  const overall = checkTags(plan, commit);
  const missing = plan.filter((item) => !hasTag(item.tag));
  for (const item of missing) assertSamePackage(item.gitHead, commit, item.packagePath);
  pushSignedTags(missing);
  for (const item of plan) githubTag(item.tag, item.gitHead);
  // The overall tag follows verified package tags, before any npm publication.
  if (overall) {
    if (!hasTag(overall.tag)) pushSignedTags([overall]);
    githubTag(overall.tag, commit);
  }
  verifyTags(plan, commit);
}

function main() {
  const [command, file] = process.argv.slice(2);
  const commit = process.env.APPROVED_COMMIT;
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.equal(git('rev-parse', 'HEAD'), commit);
  git('diff', '--exit-code');
  git('diff', '--cached', '--exit-code');
  if (command === 'plan') {
    git('fetch', 'origin', '--tags');
    // Lerna is the source of package membership and reviewed independent versions.
    // Running lerna version again here would recalculate the already-reviewed release.
    const packages = JSON.parse(
      execFileSync('pnpm', ['exec', 'lerna', 'list', '--json', '--no-private'], {
        encoding: 'utf8',
      })
    );
    const plan = tagPlan(packages, commit);
    writeFileSync(file, JSON.stringify(plan, null, 2) + '\n');
    const unit = plan.find((item) => item.name === '@suites/unit');
    const overall = unit?.gitHead === commit ? `v${unit.version}` : '';
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `release_tag=${overall}\n`);
    const summary =
      `## Tag release\n\nSource: ${commit}\n\n` +
      plan.map((item) => `- ${item.tag}`).join('\n') +
      (overall ? `\n- ${overall}\n` : '\n') +
      '\nThis action does not publish npm packages or create GitHub Releases.\n';
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  } else if (command === 'tag') {
    const plan = JSON.parse(readFileSync(file));
    assert(plan.length > 0);
    createTags(plan, commit);
  } else throw new Error(`Unknown tagging command: ${command}`);
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { tagPlan };
