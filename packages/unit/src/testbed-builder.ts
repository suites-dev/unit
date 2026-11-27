import * as console from 'console';
import type { Type } from '@suites/types.common';
import { diContract, doublesContract } from './package-resolver.base.js';
import { UnitMocker } from '@suites/core.unit';
import { createPackageResolver } from './package-resolver.js';
import type { DoublesAdapter } from '@suites/types.doubles';

/**
 * Discovery order for mocking library adapter packages. Suites ships the Jest and Vitest adapters.
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
 * Discovery order for DI adapters. Suites ships NestJS, InversifyJS and InjectionJS adapters.
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

function onCompile<T>(load: () => Promise<T>): PromiseLike<T> {
  let pending: Promise<T> | undefined;
  return {
    then(onFulfilled, onRejected) {
      pending ??= load();
      return pending.then(onFulfilled, onRejected);
    },
  };
}

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
        doubles: PromiseLike<DoublesAdapter>,
        mocker: UnitMocker,
        target: Type<TClass>,
        logger: Console
      ) => TBuilder
    ): TBuilder {
      const diAdapter = onCompile(() =>
        createPackageResolver(diAdapters, diContract).resolveCorrespondingAdapter()
      );
      const doublesAdapter = onCompile(() =>
        createPackageResolver(doublesAdapters, doublesContract).resolveCorrespondingAdapter()
      );
      const mock = onCompile(async () => (await doublesAdapter).mock);
      const unitMocker = new UnitMocker(mock, diAdapter);
      return new testbedBuilderType(doublesAdapter, unitMocker, targetClass, console);
    },
  };
}
