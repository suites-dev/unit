const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const { relative, resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const shaPattern = /^[0-9a-f]{40}$/;
const stablePattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const registry = 'https://registry.npmjs.org/';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();
const hasTag = (tag) =>
  spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`]).status === 0;

function assertSamePackage(publishedCommit, approvedCommit, packagePath, runGit = git) {
  assert.match(publishedCommit, shaPattern, 'Published source must identify a full commit');
  runGit('merge-base', '--is-ancestor', publishedCommit, approvedCommit);
  runGit('diff', '--exit-code', publishedCommit, approvedCommit, '--', packagePath);
}

// A failed registry request is never interpreted as permission to upload, except E404.
function npmJson(args, allowMissing = false) {
  const result = spawnSync('npm', [...args, '--json', '--registry', registry, '--prefer-online'], {
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, NPM_CONFIG_FETCH_RETRIES: '0', NPM_CONFIG_FETCH_TIMEOUT: '10000' },
  });
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm ${args.join(' ')} returned no valid JSON`);
  }
  if (result.status !== 0 || data.error) {
    if (allowMissing && result.status !== null && data.error?.code === 'E404') return null;
    throw new Error(`npm ${args.join(' ')} failed: ${data.error?.code || result.status}`);
  }
  return data;
}

function assertIdentity(data, name, version, commit) {
  assert.equal(data.name, name, 'Registry package name mismatch');
  assert.equal(data.version, version, 'Registry package version mismatch');
  assert.match(data.gitHead, shaPattern, 'Registry gitHead is missing or invalid');
  if (commit)
    assert.equal(data.gitHead, commit, 'Registry gitHead differs from the publication plan');
}

function assertDistTags(tags) {
  assert(tags && !Array.isArray(tags) && typeof tags === 'object', 'Invalid registry dist-tags');
  assert(
    Object.values(tags).every((tag) => typeof tag === 'string'),
    'Invalid registry dist-tag value'
  );
}

function createPlan(packages, commit, io = {}) {
  const runGit = io.git || git;
  const readManifest =
    io.readManifest || ((location) => JSON.parse(readFileSync(resolve(location, 'package.json'))));
  const query = io.npm || npmJson;
  const tagExists = io.hasTag || hasTag;
  assert.match(commit, shaPattern, 'Supply a full reviewed commit SHA');
  assert(packages.length > 0, 'No public packages found');
  return packages.map(({ name, version, location, private: isPrivate }) => {
    assert.equal(isPrivate, false);
    assert.match(name, /^@suites\/[a-z][a-z.\d-]*$/);
    assert.match(version, stablePattern, `${name}: only stable versions may publish to latest`);
    const packagePath = relative(process.cwd(), location);
    assert(
      packagePath.startsWith('packages/') && !packagePath.split('/').includes('..'),
      'Package must be inside packages/'
    );
    const manifest = readManifest(location);
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, version);
    assert.equal(manifest.repository.url, 'https://github.com/suites-dev/unit.git');
    assert.equal(manifest.publishConfig.access, 'public');
    assert.equal(manifest.publishConfig.provenance, true);
    const tag = `${name}@${version}`;
    const tagCommit = tagExists(tag) ? runGit('rev-parse', `refs/tags/${tag}^{commit}`) : null;
    if (tagCommit) assertSamePackage(tagCommit, commit, packagePath, runGit);
    const published = query(['view', tag], true);
    if (published) {
      assertIdentity(published, name, version);
      assertSamePackage(published.gitHead, commit, packagePath, runGit);
      const tags = query(['view', name, 'dist-tags']);
      assertDistTags(tags);
      // A same-commit rerun must finish the original latest release, not silently accept a partial upload.
      if (published.gitHead === commit)
        assert.equal(
          tags.latest,
          version,
          `${tag}: published but latest differs; inspect npm before retrying`
        );
      return {
        name,
        version,
        packagePath,
        tag,
        tagCommit,
        gitHead: published.gitHead,
        disposition: 'preserve',
        latest: tags.latest ?? null,
      };
    }
    return {
      name,
      version,
      packagePath,
      tag,
      tagCommit,
      gitHead: commit,
      disposition: 'publish',
      latest: version,
    };
  });
}

async function verifyPlan(
  plan,
  {
    query = npmJson,
    wait = delay,
    now = Date.now,
    timeout = 600000,
    destination = process.env.RUNNER_TEMP,
  } = {}
) {
  const deadline = now() + timeout;
  for (const item of plan) {
    while (true) {
      const mayWait = item.disposition === 'publish';
      const published = query(['view', item.tag], mayWait);
      if (published) {
        assertIdentity(published, item.name, item.version, item.gitHead);
        const tags = query(['view', item.name, 'dist-tags'], mayWait);
        if (tags) {
          assertDistTags(tags);
          if ((tags.latest ?? null) === item.latest) {
            const packed = query(
              ['pack', item.tag, '--ignore-scripts', '--pack-destination', destination],
              mayWait
            );
            if (packed) break;
          } else if (!mayWait) {
            throw new Error(`${item.name}: latest changed for a preserved package`);
          }
        }
      }
      assert(
        mayWait && now() < deadline,
        `Timed out verifying ${item.tag}; inspect npm before rerunning`
      );
      console.log(`${item.tag}: waiting for npm visibility (read-only verification)`);
      await wait(10000);
    }
    console.log(`${item.tag}: verified ${item.disposition} at ${item.gitHead}`);
  }
}

function releaseNotes(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex(
    (line) =>
      /^#{1,3} /.test(line) &&
      (line.startsWith(`# ${version} `) ||
        line.startsWith(`## ${version} `) ||
        line.startsWith(`### ${version} `) ||
        line.includes(`[${version}]`))
  );
  assert(start >= 0, `Missing changelog entry for ${version}`);
  const next = lines.findIndex((line, i) => i > start && /^#{1,3} (?:\[)?\d+\.\d+\.\d+/.test(line));
  return (
    lines
      .slice(start, next < 0 ? undefined : next)
      .join('\n')
      .trim() + '\n'
  );
}

function finalize(plan, commit) {
  assert.equal(git('rev-parse', 'HEAD'), commit);
  git('diff', '--exit-code');
  git('diff', '--cached', '--exit-code');
  // Refresh remote tags before creating anything; a conflict is never force-updated.
  git('fetch', 'origin', '--tags');
  const missing = [];
  for (const item of plan) {
    if (hasTag(item.tag)) {
      assertSamePackage(
        git('rev-parse', `refs/tags/${item.tag}^{commit}`),
        commit,
        item.packagePath
      );
    } else {
      assertSamePackage(item.gitHead, commit, item.packagePath);
      missing.push(item);
    }
  }
  for (const item of missing)
    git(
      '-c',
      'tag.gpgSign=false',
      'tag',
      '-a',
      item.tag,
      item.gitHead,
      '-m',
      `Release ${item.tag}`
    );
  if (missing.length)
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
      ...missing.map((item) => `refs/tags/${item.tag}`)
    );
  for (const item of plan.filter((entry) => entry.gitHead === commit)) {
    const result = spawnSync(
      'gh',
      [
        'api',
        `repos/${process.env.GITHUB_REPOSITORY}/releases/tags/${encodeURIComponent(item.tag)}`,
      ],
      { encoding: 'utf8' }
    );
    if (result.status === 0) {
      const release = JSON.parse(result.stdout);
      assert.equal(release.tag_name, item.tag);
      assert.equal(release.draft, false);
      assert.equal(release.prerelease, false);
      continue;
    }
    assert.match(
      result.stderr,
      /HTTP 404/,
      'Cannot determine whether GitHub Release already exists'
    );
    const notes = releaseNotes(
      readFileSync(resolve(item.packagePath, 'CHANGELOG.md'), 'utf8'),
      item.version
    );
    execFileSync(
      'gh',
      [
        'release',
        'create',
        item.tag,
        '--verify-tag',
        '--title',
        item.tag,
        '--notes-file',
        '-',
        '--latest=false',
      ],
      { input: notes, stdio: ['pipe', 'inherit', 'inherit'] }
    );
  }
}

async function main() {
  const [command, file] = process.argv.slice(2);
  const commit = process.env.APPROVED_COMMIT;
  assert.match(commit, shaPattern);
  assert.equal(git('rev-parse', 'HEAD'), commit);
  if (command === 'plan') {
    const packages = JSON.parse(
      execFileSync('pnpm', ['exec', 'lerna', 'list', '--json', '--no-private'], {
        encoding: 'utf8',
      })
    );
    const plan = createPlan(packages, commit);
    git('diff', '--exit-code');
    git('diff', '--cached', '--exit-code');
    for (const item of plan.filter((entry) => entry.gitHead === commit)) {
      releaseNotes(readFileSync(resolve(item.packagePath, 'CHANGELOG.md'), 'utf8'), item.version);
    }
    writeFileSync(file, JSON.stringify(plan, null, 2) + '\n');
    const summary =
      `## Publication plan\n\nCommit: \`${commit}\`\n\n` +
      plan.map((item) => `- \`${item.tag}\`: ${item.disposition}`).join('\n') +
      '\n';
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `pending=${plan.filter((item) => item.disposition === 'publish').length}\n`
      );
  } else {
    const plan = JSON.parse(readFileSync(file));
    assert(plan.length > 0);
    if (command === 'verify') await verifyPlan(plan);
    else if (command === 'finalize') finalize(plan, commit);
    else throw new Error(`Unknown release command: ${command}`);
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { assertSamePackage, createPlan, npmJson, verifyPlan, releaseNotes };
