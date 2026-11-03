// Keep prerelease notes cumulative so graduation includes the full migration
// since the previous stable release, rather than only the last prerelease tag.
module.exports = async () => {
  const { default: angular } = await import('conventional-changelog-angular');
  return {
    ...angular(),
    tags: { skipUnstable: true },
  };
};
