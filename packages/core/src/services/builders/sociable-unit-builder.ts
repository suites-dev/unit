import type { DoublesAdapter } from '@suites/types.doubles';
import { resolveAdapter } from '../../adapter-provider.js';
import type { AdapterProvider } from '../../adapter-provider.js';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { AbstractType, Type } from '@suites/types.common';
import { UnitReference } from '../unit-reference.js';
import type { UnitMocker } from '../unit-mocker.js';
import type { ResolverOptions } from '../dependency-resolver.js';
import type { IdentifierToMockOrFinal } from '../dependency-container.js';
import { DependencyContainer } from '../dependency-container.js';
import type { FluentMockOverride, UnitTestBed } from '../../types.js';
import { TestBedBuilder, type FluentTestBedBuilder } from './testbed-builder.js';

export interface SociableTestBedBuilder<TClass> {
  expose(dependency: Type): SociableTestBedBuilder<TClass>;
}

/** A sociable graph with explicitly selected mocked boundaries. */
export interface ComposedTestBedBuilder<TClass> extends FluentTestBedBuilder<TClass> {
  exclude(...identifiers: [InjectableIdentifier, ...InjectableIdentifier[]]): this;
}

abstract class SociableBuilderBase<TClass> extends TestBedBuilder<TClass> {
  protected readonly classesToExpose: Type[] = [];
  protected readonly exposedBindings = new Map<InjectableIdentifier, Type>();
  protected abstract get resolutionOptions(): ResolverOptions;

  public constructor(
    protected readonly doublesAdapter: AdapterProvider<DoublesAdapter>,
    protected readonly unitMocker: UnitMocker,
    protected readonly targetClass: Type<TClass>,
    protected readonly logger: Console
  ) {
    super();
  }

  protected copyMockConfigurationTo(builder: SociableBuilderBase<TClass>): void {
    builder.identifiersToBeMocked.push(...this.identifiersToBeMocked);
    builder.identifiersToBeFinalized.push(...this.identifiersToBeFinalized);
  }

  public async compile(): Promise<UnitTestBed<TClass>> {
    const doublesAdapter = await resolveAdapter(this.doublesAdapter);
    const mockFn = doublesAdapter.mock;
    const stubCb = doublesAdapter.stub;

    const identifiersToMocks: IdentifierToMockOrFinal[] = this.identifiersToBeMocked.map(
      ([identifier, mockImplCallback]) => {
        return [identifier, mockFn(mockImplCallback(stubCb))];
      }
    );

    const identifiersToFinal: IdentifierToMockOrFinal[] = this.identifiersToBeFinalized.map(
      ([identifier, finalImpl]: IdentifierToMockOrFinal) => {
        return [identifier, finalImpl];
      }
    );

    const { container, instance, resolution, composedDependencies, exposedDependencies } =
      await this.unitMocker.constructUnit<TClass>(
        this.targetClass,
        this.classesToExpose,
        new DependencyContainer([...identifiersToMocks, ...identifiersToFinal]),
        {
          resolution: this.resolutionOptions,
        }
      );

    if (resolution.mocks.length > 0) {
      resolution.mocks.forEach((identifier) => {
        this.logger.warn(`Suites Warning: Unreachable Mock Configuration Detected.
You attempted to mock '${identifier.identifier.name}', which is not directly involved in the current testing context of '${this.targetClass.name}'.
This mock will not affect the outcome of your tests because '${identifier.identifier.name}' is neither a direct dependency of the tested unit nor is it
among the dependencies explicitly exposed. If '${identifier.identifier.name}' does not influence the unit under test, consider removing this mock from your
setup to streamline your test configuration. However, if this mock is crucial, verify that all required dependencies are correctly exposed.
For detailed guidance on configuring sociable tests, please consult: https://suites.dev/docs.`);
      });
    }

    if (resolution.exposes.length > 0) {
      resolution.exposes.forEach((identifier) => {
        this.logger.warn(`Suites Warning: Unreachable Exposed Dependency Detected.
The dependency '${identifier.name}' has been exposed but cannot be reached within the current testing context.
This typically occurs because '${identifier.name}' is not a direct dependency of the unit under test (${this.targetClass.name}) nor any
of its other exposed dependencies. Exposing '${identifier.name}' without it being accessible from the unit under test or
its dependencies may lead to incorrect test configurations. To resolve this, please review and adjust your testing
setup to ensure all necessary dependencies are interconnected. Alternatively, if '${identifier.name}' does not influence
the unit under test, consider removing its exposure from your test setup.
For detailed instructions and best practices, refer to our documentation: https://suites.dev/docs.`);
      });
    }

    for (const token of resolution.exposedTokens ?? []) {
      this.logger.warn(
        `Suites Warning: Unreachable Exposed Dependency Detected. The dependency ${String(token)} ` +
          `cannot be reached within the testing context of ${this.targetClass.name}.`
      );
    }

    return {
      unit: instance,
      unitRef: new UnitReference(
        container,
        this.classesToExpose,
        this.identifiersToBeFinalized,
        composedDependencies,
        exposedDependencies
      ),
    };
  }
}

export class SociableTestBedBuilder<TClass> extends SociableBuilderBase<TClass> {
  protected get resolutionOptions(): ResolverOptions {
    return { exposedBindings: this.exposedBindings };
  }

  public expose(dependency: Type): SociableTestBedBuilder<TClass> {
    this.classesToExpose.push(dependency);
    return this;
  }
}

export class FluentSociableTestBedBuilder<TClass> extends SociableTestBedBuilder<TClass> {
  public mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    metadata?: IdentifierMetadata
  ): FluentMockOverride<TDependency, TClass, this> {
    return this.createMockOverride(identifier, metadata);
  }

  public expose(dependency: Type): FluentSociableTestBedBuilder<TClass>;
  public expose(
    dependency: string | symbol,
    implementation: Type
  ): FluentSociableTestBedBuilder<TClass>;
  public expose<TToken extends AbstractType>(
    dependency: TToken,
    implementation: Type<InstanceType<TToken>>
  ): FluentSociableTestBedBuilder<TClass>;
  public expose(
    dependency: AbstractType | string | symbol,
    implementation?: Type
  ): FluentSociableTestBedBuilder<TClass> {
    if (typeof dependency === 'function' && implementation === undefined) {
      const existing = this.exposedBindings.get(dependency);
      if (existing !== undefined && existing !== dependency) {
        throw new Error('Cannot expose different implementations for the same dependency token.');
      }
      this.classesToExpose.push(dependency as Type);
    } else if (typeof implementation === 'function') {
      const existing = this.exposedBindings.get(dependency);
      if (
        (existing !== undefined && existing !== implementation) ||
        (this.classesToExpose.some((type) => type === dependency) && implementation !== dependency)
      ) {
        throw new Error('Cannot expose different implementations for the same dependency token.');
      }
      this.exposedBindings.set(dependency, implementation);
    } else {
      throw new Error('Exposing a dependency token requires a concrete implementation.');
    }
    return this;
  }

  /** Recursively constructs discovered classes. Exclude abstract tokens and I/O explicitly. */
  public compose(): ComposedTestBedBuilder<TClass> {
    if (this.classesToExpose.length > 0 || this.exposedBindings.size > 0) {
      throw new Error('Cannot combine .compose() with .expose(); choose one sociable strategy.');
    }
    const composed = new ComposedSociableTestBedBuilder(
      this.doublesAdapter,
      this.unitMocker,
      this.targetClass,
      this.logger
    );
    this.copyMockConfigurationTo(composed);
    return composed;
  }
}

class ComposedSociableTestBedBuilder<TClass>
  extends SociableBuilderBase<TClass>
  implements ComposedTestBedBuilder<TClass>
{
  public mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    metadata?: IdentifierMetadata
  ): FluentMockOverride<TDependency, TClass, this> {
    return this.createMockOverride(identifier, metadata);
  }

  private readonly excludedIdentifiers: InjectableIdentifier[] = [];

  protected get resolutionOptions(): ResolverOptions {
    return { compose: true, excludedIdentifiers: this.excludedIdentifiers };
  }

  public exclude(...identifiers: [InjectableIdentifier, ...InjectableIdentifier[]]): this {
    if (identifiers.length === 0) {
      throw new Error('.exclude() requires at least one dependency identifier.');
    }
    this.excludedIdentifiers.push(...identifiers);
    return this;
  }
}
