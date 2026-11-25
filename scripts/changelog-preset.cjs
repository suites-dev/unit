const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

// A patch release can ship from a maintenance branch while mainline carries
// unpublished features. Only a merge that restores the entire published package
// can serve as the starting point for that package's subsequent release notes.
function reconciledCommits(cwd, context) {
  const pkg = context.packageData;
  const directory = pkg?.repository?.directory;
  const tag = context.gitSemverTags?.[0];
  if (!directory || !tag?.startsWith(`${pkg.name}@`)) return new Set();

  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const release = git('rev-parse', '--verify', `${tag}^{commit}`);
  const range = git('rev-list', '--first-parent', '--parents', `${release}..HEAD`);
  if (!range) return new Set();
  const mainline = range
    .split('\n')
    .map((line) => line.split(' '))
    .reverse();
  if (mainline[0][1] === release) return new Set();

  const packageTree = (ref) => git('ls-tree', '--full-tree', ref, '--', directory);
  const publishedTree = packageTree(release);
  if (publishedTree) {
    for (const [commit, , mergeParent] of mainline) {
      if (mergeParent && packageTree(commit) === publishedTree) {
        const beforeMerge = `${release}..${commit}`;
        if (git('rev-list', '-1', '--ancestry-path', beforeMerge)) {
          return new Set(git('rev-list', beforeMerge).split('\n'));
        }
      }
    }
  }
  return new Set();
}

module.exports = async ({ cwd = join(__dirname, '..') } = {}) => {
  const { default: angular } = await import('conventional-changelog-angular');
  const preset = angular();
  const reconciled = new WeakMap();

  return {
    ...preset,
    // Keep prerelease notes cumulative through graduation.
    tags: { skipUnstable: true },
    writer: {
      ...preset.writer,
      transform(commit, context) {
        if (!reconciled.has(context)) reconciled.set(context, reconciledCommits(cwd, context));
        if (reconciled.get(context).has(commit.hash)) return null;
        return preset.writer.transform(commit, context);
      },
    },
  };
};
