import type { DependencyInjectionAdapter } from '@suites/types.di';
import { createPackageResolver } from '../src/package-resolver.js';
import { diContract, type PackageResolver } from '../src/package-resolver.base.js';
import { SuitesDIAdapters, SuitesDoublesAdapters } from '../src/testbed-builder.js';

class EmptyService {}

describe('Suites Adapter Package Resolving Integration Test', () => {
  describe('DI Adapters Registry', () => {
    it('should include all supported DI adapters', () => {
      const adapters = Object.keys(SuitesDIAdapters);
      expect(adapters).toContain('nestjs');
      expect(adapters).toContain('inversify');
      expect(adapters).toContain('tsyringe');
    });

    it('should include all supported doubles adapters', () => {
      const adapters = Object.keys(SuitesDoublesAdapters);
      expect(adapters).toContain('jest');
      expect(adapters).not.toContain('sinon');
      expect(adapters).toContain('vitest');
    });
  });

  let packageResolver: PackageResolver<DependencyInjectionAdapter>;

  describe('Resolving an adapter with named adapter export', () => {
    beforeAll(() => {
      packageResolver = createPackageResolver(
        { test: __dirname + '/assets/test-adapter' },
        diContract
      );
    });

    it('should successfully resolve the adapter package', async () => {
      const diAdapter = await packageResolver.resolveCorrespondingAdapter();
      expect(diAdapter.inspect(EmptyService).list()).toEqual([]);
    });
  });

  describe('Resolving an adapter without a named adapter export', () => {
    beforeAll(() => {
      packageResolver = createPackageResolver(
        { test: __dirname + '/assets/invalid-adapter' },
        diContract
      );
    });

    it('should reject the invalid adapter export', async () => {
      await expect(() => packageResolver.resolveCorrespondingAdapter()).rejects.toThrow(
        'Expected a named "adapter" export'
      );
    });
  });
});
