import { createRequire } from 'node:module';
import { checkPackage, PackageResolver, type AdapterContract } from './package-resolver.base.js';

export function createPackageResolver<T>(
  adapters: Readonly<Record<string, string>>,
  contract: AdapterContract<T>
): PackageResolver<T> {
  // Some test runners expose require.resolve in place of import.meta.resolve.
  const requireFromUnit = typeof require === 'function' ? require : createRequire(import.meta.url);
  return new PackageResolver(
    adapters,
    (name) =>
      checkPackage(
        name,
        () =>
          typeof import.meta.resolve === 'function'
            ? import.meta.resolve(name)
            : requireFromUnit.resolve(name),
        () => requireFromUnit.resolve.paths(name)
      ),
    contract
  );
}
