import { checkPackage, PackageResolver, type AdapterContract } from './package-resolver.base.js';

export function createPackageResolver<T>(
  adapters: Readonly<Record<string, string>>,
  contract: AdapterContract<T>
): PackageResolver<T> {
  return new PackageResolver(
    adapters,
    (name) =>
      checkPackage(
        name,
        () => require.resolve(name),
        () => require.resolve.paths(name)
      ),
    contract
  );
}
