import * as console from 'console';
import type { Type } from '@suites/types.common';
import { diContract, doublesContract } from './package-resolver.base.js';
import { UnitMocker } from '@suites/core.unit';
import { createPackageResolver } from './package-resolver.js';
import type { DoublesAdapter } from '@suites/types.doubles';

/**
 * Registry of supported mocking library adapter packages.
 *
 * Maps mocking library names to their corresponding Suites adapter package names.
 * Suites automatically detects which library is installed and loads the appropriate adapter.
 *
 * @since 3.0.0
 */
export const SuitesDoublesAdapters = {
  jest: '@suites/doubles.jest',
  vitest: '@suites/doubles.vitest',
  bun: '@suites/doubles.bun',
  deno: '@suites/doubles.deno',
  node: '@suites/doubles.node',
} as const;

/**
 * Registry of supported dependency injection framework adapter packages.
 *
 * Maps DI framework names to their corresponding Suites adapter package names.
 * Suites automatically detects which DI framework is installed and loads the appropriate adapter.
 *
 * @since 3.0.0
 */
export const SuitesDIAdapters = {
  nestjs: '@suites/di.nestjs',
  inversify: '@suites/di.inversify',
  injectionjs: '@suites/di.injectionjs',
  tsyringe: '@suites/di.tsyringe',
} as const;

/**
 * Factory function for creating TestBedBuilder instances with automatic adapter resolution.
 *
 * This function resolves and configures the appropriate DI and mocking library adapters
 * based on what's installed in the project, then creates a builder for the specified target class.
 *
 * @internal This is used internally by TestBed.solitary() and TestBed.sociable()
 * @template TClass The type of the class to be tested
 * @param diAdapters - Registry of DI framework adapters
 * @param doublesAdapters - Registry of mocking library adapters
 * @param targetClass - The class for which to create the test environment
 * @returns Factory object with a create method for building TestBedBuilder instances
 * @since 3.0.0
 */
export function testBedBuilderFactory<TClass>(
  diAdapters: Readonly<Record<string, string>>,
  doublesAdapters: Readonly<Record<string, string>>,
  targetClass: Type<TClass>
) {
  return {
    create<TBuilder>(
      testbedBuilderType: new (
        doubles: Promise<DoublesAdapter>,
        mocker: UnitMocker,
        target: Type<TClass>,
        logger: Console
      ) => TBuilder
    ): TBuilder {
      const diAdapter = createPackageResolver(diAdapters, diContract).resolveCorrespondingAdapter();
      const doublesAdapter = createPackageResolver(
        doublesAdapters,
        doublesContract
      ).resolveCorrespondingAdapter();
      const mock = doublesAdapter.then((adapter) => adapter.mock);

      // Compilation can start on a later turn or stop after the first adapter failure.
      // Observe both pending inputs while retaining their rejections for compile().
      void Promise.allSettled([diAdapter, mock]);
      const unitMocker = new UnitMocker(mock, diAdapter);
      return new testbedBuilderType(doublesAdapter, unitMocker, targetClass, console);
    },
  };
}
