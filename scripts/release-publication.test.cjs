const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const {
  assertSamePackage,
  createPlan,
  verifyPlan,
  releaseNotes,
} = require('./release-publication.cjs');
const commit = 'a'.repeat(40);
const older = 'b'.repeat(40);
const pkg = {
  name: '@suites/unit',
  version: '4.0.0',
  location: resolve('packages/unit'),
  private: false,
};
const manifest = {
  ...pkg,
  repository: { url: 'https://github.com/suites-dev/unit.git' },
  publishConfig: { access: 'public', provenance: true },
};
const published = { name: pkg.name, version: pkg.version, gitHead: commit };
const io = (npm, extra = {}) => ({
  npm,
  readManifest: () => manifest,
  hasTag: () => false,
  git: () => '',
  ...extra,
});

test('new stable version is planned for latest at the reviewed commit', () => {
  const [plan] = createPlan(
    [pkg],
    commit,
    io(() => null)
  );
  assert.equal(plan.disposition, 'publish');
  assert.equal(plan.gitHead, commit);
  assert.equal(plan.latest, '4.0.0');
});

test('unchanged independent packages preserve earlier source commits and latest tags', () => {
  const [plan] = createPlan(
    [pkg],
    commit,
    io((args) =>
      args.includes('dist-tags') ? { latest: '4.0.1' } : { ...published, gitHead: older }
    )
  );
  assert.equal(plan.disposition, 'preserve');
  assert.equal(plan.gitHead, older);
  assert.equal(plan.latest, '4.0.1');
});

test('same-commit retry verifies latest instead of treating a partial upload as complete', () => {
  assert.throws(
    () =>
      createPlan(
        [pkg],
        commit,
        io((args) => (args.includes('dist-tags') ? { latest: '3.1.1' } : published))
      ),
    /latest differs/
  );
});

test('prereleases, wrong provenance repository, and registry errors fail closed', () => {
  assert.throws(
    () =>
      createPlan(
        [{ ...pkg, version: '4.0.0-next.0' }],
        commit,
        io(() => null)
      ),
    /stable/
  );
  assert.throws(
    () =>
      createPlan(
        [pkg],
        commit,
        io(() => null, {
          readManifest: () => ({
            ...manifest,
            repository: { url: 'https://github.com/suites-dev/suites.git' },
          }),
        })
      ),
    /unit.git/
  );
  assert.throws(
    () =>
      createPlan(
        [pkg],
        commit,
        io(() => {
          throw Error('E403');
        })
      ),
    /E403/
  );
});

test('existing conflicting Git tags are rejected before registry publication', () => {
  assert.throws(
    () =>
      createPlan(
        [pkg],
        commit,
        io(() => null, {
          hasTag: () => true,
          git: (...args) => {
            if (args[0] === 'rev-parse') return older;
            if (args[0] === 'diff') throw Error('package differs');
            return '';
          },
        })
      ),
    /package differs/
  );
});

test('real Git history accepts unchanged packages but rejects changed or unrelated versions', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'suites-publication-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '--initial-branch=master');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  mkdirSync(join(root, 'packages/unit'), { recursive: true });
  writeFileSync(join(root, 'packages/unit/index.js'), 'original');
  git('add', '.');
  git('commit', '-m', 'initial');
  const first = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'README.md'), 'outside package');
  git('add', '.');
  git('commit', '-m', 'docs');
  const second = git('rev-parse', 'HEAD');
  assert.doesNotThrow(() => assertSamePackage(first, second, 'packages/unit', git));
  writeFileSync(join(root, 'packages/unit/index.js'), 'changed');
  git('add', '.');
  git('commit', '-m', 'fix');
  assert.throws(() => assertSamePackage(first, git('rev-parse', 'HEAD'), 'packages/unit', git));
  assert.throws(() => assertSamePackage(git('rev-parse', 'HEAD'), first, 'packages/unit', git));
});

test('post-upload verification tolerates E404 visibility and checks source, tag and tarball', async () => {
  const [plan] = createPlan(
    [pkg],
    commit,
    io(() => null)
  );
  let requests = 0,
    waits = 0,
    packs = 0;
  await verifyPlan([plan], {
    destination: tmpdir(),
    now: () => 0,
    wait: async () => {
      waits++;
    },
    query: (args) => {
      if (args[0] === 'pack') {
        packs++;
        assert(args.includes('--ignore-scripts'));
        return [{}];
      }
      if (args.includes('dist-tags')) return { latest: '4.0.0' };
      return requests++ === 0 ? null : published;
    },
  });
  assert.equal(waits, 1);
  assert.equal(packs, 1);
});

test('verification never retries wrong source identity, non-404 errors, or preserved tag drift', async () => {
  const [plan] = createPlan(
    [pkg],
    commit,
    io(() => null)
  );
  const neverWait = async () => {
    assert.fail('must not retry');
  };
  await assert.rejects(
    verifyPlan([plan], { wait: neverWait, query: () => ({ ...published, gitHead: older }) }),
    /gitHead differs/
  );
  await assert.rejects(
    verifyPlan([plan], {
      wait: neverWait,
      query: () => {
        throw Error('E503');
      },
    }),
    /E503/
  );
  await assert.rejects(
    verifyPlan([{ ...plan, disposition: 'preserve' }], {
      wait: neverWait,
      query: (args) => (args.includes('dist-tags') ? { latest: '3.1.1' } : published),
    }),
    /latest changed/
  );
});

test('registry visibility retries have a bounded deadline', async () => {
  const [plan] = createPlan(
    [pkg],
    commit,
    io(() => null)
  );
  let clock = 0;
  await assert.rejects(
    verifyPlan([plan], { query: () => null, now: () => clock++, timeout: 1 }),
    /Timed out/
  );
});

test('GitHub release notes include only the requested package version and its breaking changes', () => {
  const changelog =
    '# Change Log\n\n# [4.0.0](url) (date)\n\n### BREAKING CHANGES\n\n* Node 22 minimum\n\n## [3.1.1](old) (date)\n\nOld fix\n';
  assert.equal(
    releaseNotes(changelog, '4.0.0'),
    '# [4.0.0](url) (date)\n\n### BREAKING CHANGES\n\n* Node 22 minimum\n'
  );
  assert.throws(() => releaseNotes(changelog, '4.1.0'), /Missing changelog/);
});

test('tags created before a failed npm upload pin retries to the original source commit', () => {
  const existing = {
    hasTag: () => true,
    git: (...args) => (args[0] === 'rev-parse' ? commit : ''),
  };
  const [plan] = createPlan(
    [pkg],
    commit,
    io(() => null, existing)
  );
  assert.equal(plan.disposition, 'publish');
  assert.equal(plan.gitHead, commit);
  assert.throws(
    () =>
      createPlan(
        [pkg],
        commit,
        io(() => null, {
          ...existing,
          git: (...args) => (args[0] === 'rev-parse' ? older : ''),
        })
      ),
    /unpublished version is already tagged at another commit/
  );
});
