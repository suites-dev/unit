import type { IdentifierToFinal, IdentifierToMockImplWithCb } from '../dependency-container.js';
import type { DeepPartial, FinalValue, AbstractType } from '@suites/types.common';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import { normalizeIdentifier } from '../../normalize-identifier.static.js';
import type { MockOverride, UnitTestBed } from '../../types.js';
import type { ArgsType, Stub } from '@suites/types.doubles';

export abstract class TestBedBuilder<TClass> implements TestBedBuilder<TClass> {
  protected readonly identifiersToBeMocked: IdentifierToMockImplWithCb[] = [];
  protected readonly identifiersToBeFinalized: IdentifierToFinal[] = [];

  public mock<TDependency>(
    type: AbstractType<TDependency>
  ): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(
    type: AbstractType<TDependency>,
    identifierMetadata: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(token: string): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(
    token: string,
    identifierMetadata: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(token: symbol): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(
    token: symbol,
    identifierMetadata: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;
  public mock<TDependency>(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this> {
    return {
      auto: (): this => {
        this.identifiersToBeMocked.push([
          normalizeIdentifier(identifier, metadata as never),
          () => ({}),
        ]);

        return this;
      },
      impl: (
        mockImplementation: (
          stubFn: () => Stub<TDependency, ArgsType<TDependency>>
        ) => DeepPartial<TDependency>
      ): this => {
        this.identifiersToBeMocked.push([
          normalizeIdentifier(identifier, metadata as never),
          mockImplementation,
        ]);

        return this;
      },
      final: (finalImplementation: FinalValue<TDependency>): this => {
        this.identifiersToBeFinalized.push([
          normalizeIdentifier(identifier, metadata as never),
          finalImplementation,
        ]);

        return this;
      },
    };
  }

  /**
   * Compiles the UnitTestBed instance.
   *
   * This method sets up and initializes the test environment for the specified class,
   * resolving all dependencies and applying the defined mocks. The result is a
   * `UnitTestBed` instance that provides access to the class under test and its
   * mocked dependencies, ready for testing.
   *
   * @since 3.0.0
   * @returns A Promise that resolves to the compiled `UnitTestBed` instance.
   * @template TClass The type of the class being tested.
   * @example
   * ```ts
   * const unitTestBed = await testBedBuilder.compile();
   * const { unit, unitRef } = unitTestBed;
   * // unit is the instance of the class under test
   * // unitRef provides access to the mocked dependencies
   * ```
   */
  public abstract compile(): Promise<UnitTestBed<TClass>>;
}

/**
 * Interface representing a builder for configuring and creating test beds for unit testing classes.
 *
 * @template TClass The type of the class being tested.
 * @since 3.0.0
 */
export interface TestBedBuilder<TClass> {
  /**
   * Declares a dependency to be mocked using its type.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @param type - The type representing the dependency to be mocked.
   * @template TClass The type of the class being tested.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MyService);
   * ```
   */
  mock<TDependency>(type: AbstractType<TDependency>): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using its type along with a corresponding metadata object.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @template TClass The type of the class being tested.
   * @param type - The type representing the dependency to be mocked.
   * @param identifierMetadata - Metadata object that corresponds to the type identifier.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MyService, metadata);
   * ```
   */
  mock<TDependency>(
    type: AbstractType<TDependency>,
    identifierMetadata: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using a string-based token.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @template TClass The type of the class being tested.
   * @param token - The string-based token representing the dependency to be mocked.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>('MyService');
   * ```
   */
  mock<TDependency>(token: string): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using a string-based token along with a corresponding metadata object.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @template TClass The type of the class being tested.
   * @param token - The string-based token representing the dependency to be mocked.
   * @param identifierMetadata - Metadata object that corresponds to the string-based token.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>('MyService', metadata);
   * ```
   */
  mock<TDependency>(
    token: string,
    identifierMetadata: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using a symbol-based token.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @template TClass The type of the class being tested.
   * @param token - The symbol-based token representing the dependency to be mocked.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MY_SERVICE_SYMBOL);
   * ```
   */
  mock<TDependency>(token: symbol): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using a symbol-based token along with a corresponding metadata object.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @template TClass The type of the class being tested.
   * @param token - The symbol-based token representing the dependency to be mocked.
   * @param identifierMetadata - Metadata object that corresponds to the symbol-based token.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MY_SERVICE_SYMBOL, metadata);
   * ```
   */
  mock<TDependency>(
    token: symbol,
    identifierMetadata: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using its type, string-based token, or symbol-based token,
   * with an optional metadata object.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @template TClass The type of the class being tested.
   * @param identifier - The type or token representing the dependency to be mocked.
   * @param identifierMetadata - Optional metadata object for the identifier.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MyService);
   * // or
   * const mockOverride = testBedBuilder.mock<MyService>('MyService');
   * // or
   * const mockOverride = testBedBuilder.mock<MyService>(MY_SERVICE_SYMBOL, metadata);
   * ```
   */
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;
}

/**
 * Interface representing a builder for configuring and creating test beds for unit testing classes.
 *
 * @template TClass The type of the class being tested.
 */
export interface TestBedBuilder<TClass> {
  /**
   * Declares a dependency to be mocked using its type.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @param type - The type representing the dependency to be mocked.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MyService);
   * ```
   */
  mock<TDependency>(type: AbstractType<TDependency>): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using a string-based token.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @param token - The string-based token representing the dependency to be mocked.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>('MyService');
   * ```
   */
  mock<TDependency>(token: string): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using a symbol-based token.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @param token - The symbol-based token representing the dependency to be mocked.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MY_SERVICE_SYMBOL);
   * ```
   */
  mock<TDependency>(token: symbol): MockOverride<TDependency, TClass, this>;

  /**
   * Declares a dependency to be mocked using its type, string-based token, or symbol-based token.
   *
   * @since 3.0.0
   * @template TDependency The type of the dependency being mocked.
   * @param identifier - The type or token representing the dependency to be mocked.
   * @param identifierMetadata - Optional metadata object for the identifier.
   * @returns An instance of MockOverride for further configuration.
   * @example
   * ```ts
   * const mockOverride = testBedBuilder.mock<MyService>(MyService);
   * // or
   * const mockOverride = testBedBuilder.mock<MyService>('MyService');
   * // or
   * const mockOverride = testBedBuilder.mock<MyService>(MY_SERVICE_SYMBOL, metadata);
   * ```
   */
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, this>;
}
