import { DependencyResolutionError } from '@suites/types.common';
import type { AbstractType, DeepPartial, FinalValue, Type } from '@suites/types.common';
import type { ArgsType, DoublesAdapter, Stub, StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { MockOverride, UnitTestBed } from '../../types.js';
import type { IdentifierToMockOrFinal } from '../dependency-container.js';
import { DependencyContainer } from '../dependency-container.js';
import type { ResolverOptions } from '../dependency-resolver.js';
import { CompositionBoundaryContainer } from '../composition-boundary.js';
import { stringifyIdentifier } from '../functions.static.js';
import { UnitReference } from '../unit-reference.js';
import type { UnitMocker } from '../unit-mocker.js';
import { TestBedBuilder } from './testbed-builder.js';

export interface SociableTestBedBuilder<TClass> extends TestBedBuilder<TClass> {
  expose(dependency: Type, ...dependencies: Type[]): SelectiveSociableTestBedBuilder<TClass>;
  compose(): ComposedSociableTestBedBuilder<TClass>;
  bind<TDependency>(
    identifier: string | symbol,
    implementation: Type<TDependency>
  ): SociableTestBedBuilder<TClass>;
  bind<TToken extends AbstractType>(
    identifier: TToken,
    implementation: Type<InstanceType<TToken>>
  ): SociableTestBedBuilder<TClass>;
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, SociableTestBedBuilder<TClass>>;
}

interface ComposedTestBedBuilder<TClass> extends TestBedBuilder<TClass> {
  bind<TDependency>(
    identifier: string | symbol,
    implementation: Type<TDependency>
  ): ComposedTestBedBuilder<TClass>;
  bind<TToken extends AbstractType>(
    identifier: TToken,
    implementation: Type<InstanceType<TToken>>
  ): ComposedTestBedBuilder<TClass>;
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, ComposedTestBedBuilder<TClass>>;
}

interface SelectiveTestBedBuilder<TClass> extends TestBedBuilder<TClass> {
  expose(dependency: Type, ...dependencies: Type[]): SelectiveTestBedBuilder<TClass>;
  bind<TDependency>(
    identifier: string | symbol,
    implementation: Type<TDependency>
  ): SelectiveTestBedBuilder<TClass>;
  bind<TToken extends AbstractType>(
    identifier: TToken,
    implementation: Type<InstanceType<TToken>>
  ): SelectiveTestBedBuilder<TClass>;
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, SelectiveTestBedBuilder<TClass>>;
}

abstract class SociableBuilderBase<TClass> extends TestBedBuilder<TClass> {
  protected readonly classesToExpose: Type[] = [];
  protected readonly exposedBindings = new Map<InjectableIdentifier, Type>();
  protected readonly conflictingBindings = new Map<InjectableIdentifier, readonly [Type, Type]>();

  public constructor(
    protected readonly doublesAdapter: Promise<DoublesAdapter>,
    protected readonly unitMocker: UnitMocker,
    protected readonly targetClass: Type<TClass>,
    protected readonly logger: Console
  ) {
    super();
  }

  protected abstract resolverOptions(boundaries: CompositionBoundaryContainer): ResolverOptions;

  protected copyConfigurationTo(
    builder: SociableBuilderBase<TClass>,
    additionalClassesToExpose: readonly Type[] = []
  ): void {
    builder.classesToExpose.push(...this.classesToExpose, ...additionalClassesToExpose);
    this.exposedBindings.forEach((implementation, identifier) => {
      builder.exposedBindings.set(identifier, implementation);
    });
    this.conflictingBindings.forEach((implementations, identifier) => {
      builder.conflictingBindings.set(identifier, implementations);
    });
    builder.identifiersToBeMocked.push(...this.identifiersToBeMocked);
    builder.identifiersToBeFinalized.push(...this.identifiersToBeFinalized);
  }

  protected setExposedBinding(identifier: InjectableIdentifier, implementation: Type): void {
    if (typeof implementation !== 'function') {
      throw new TypeError('Binding a dependency token requires a concrete implementation');
    }

    const existing = this.exposedBindings.get(identifier);
    if (existing !== undefined && existing !== implementation) {
      this.conflictingBindings.set(identifier, [existing, implementation]);
      return;
    }

    this.exposedBindings.set(identifier, implementation);
  }

  protected createMockOverride<TDependency, TBuilder extends TestBedBuilder<TClass>>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata: IdentifierMetadata | undefined,
    builder: TBuilder
  ): MockOverride<TDependency, TClass, TBuilder> {
    const override = super.mock<TDependency>(identifier, identifierMetadata);
    return {
      impl: (
        mockImplementation: (
          stubFn: () => Stub<TDependency, ArgsType<TDependency>>
        ) => DeepPartial<TDependency>
      ) => {
        override.impl(mockImplementation);
        return builder;
      },
      final: (finalImplementation: DeepPartial<TDependency>) => {
        override.final(finalImplementation);
        return builder;
      },
    };
  }

  public async compile(): Promise<UnitTestBed<TClass>> {
    for (const [identifier, [existing, conflicting]] of this.conflictingBindings) {
      throw new DependencyResolutionError(
        `Conflicting bindings for ${stringifyIdentifier(identifier, undefined)}: ` +
          `${existing.name} and ${conflicting.name}. Bind each requested token to one implementation.`
      );
    }

    const mockFn = await this.doublesAdapter.then((adapter) => adapter.mock);
    const stubCb = await this.doublesAdapter.then((adapter) => adapter.stub);

    const identifiersToMocks: IdentifierToMockOrFinal[] = this.identifiersToBeMocked.map(
      ([identifier, mockImplCallback]) => [identifier, mockFn(mockImplCallback(stubCb))]
    );
    const identifiersToFinal: IdentifierToMockOrFinal[] = this.identifiersToBeFinalized.map(
      ([identifier, finalImpl]) => [identifier, finalImpl]
    );
    const boundaries = new CompositionBoundaryContainer([
      ...identifiersToMocks.map(([identifier, value]) => ({
        kind: 'mock' as const,
        identifier: identifier.identifier,
        metadata: identifier.metadata as IdentifierMetadata | undefined,
        value: value as StubbedInstance<unknown>,
      })),
      ...identifiersToFinal.map(([identifier, value]) => ({
        kind: 'final' as const,
        identifier: identifier.identifier,
        metadata: identifier.metadata as IdentifierMetadata | undefined,
        value: value as FinalValue,
      })),
    ]);

    const { container, instance, resolution, composedDependencies, exposedDependencies } =
      await this.unitMocker.constructUnit<TClass>(
        this.targetClass,
        this.classesToExpose,
        new DependencyContainer([...identifiersToMocks, ...identifiersToFinal]),
        this.resolverOptions(boundaries)
      );

    resolution.mocks.forEach((identifier) => {
      this.logger.warn(`Suites Warning: Unreachable Mock Configuration Detected.
You attempted to mock '${identifier.identifier.name}', which is not directly involved in the current testing context of '${this.targetClass.name}'.
This mock will not affect the outcome of your tests because '${identifier.identifier.name}' is neither a direct dependency of the tested unit nor is it
among the dependencies explicitly exposed. If '${identifier.identifier.name}' does not influence the unit under test, consider removing this mock from your
setup to streamline your test configuration. However, if this mock is crucial, verify that all required dependencies are correctly exposed.
For detailed guidance on configuring sociable tests, please consult: https://suites.dev/docs.`);
    });

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
  protected resolverOptions(): ResolverOptions {
    return { exposedBindings: this.exposedBindings, guardUndeclared: true };
  }

  public expose(
    dependency: Type,
    ...dependencies: Type[]
  ): SelectiveSociableTestBedBuilder<TClass> {
    if (!dependency) {
      throw new TypeError('Selective exposure requires at least one dependency');
    }

    const selective = new SelectiveSociableTestBedBuilder<TClass>(
      this.doublesAdapter,
      this.unitMocker,
      this.targetClass,
      this.logger
    );
    this.copyConfigurationTo(selective, [dependency, ...dependencies]);
    return selective;
  }

  public bind<TDependency>(
    identifier: string | symbol,
    implementation: Type<TDependency>
  ): SociableTestBedBuilder<TClass>;
  public bind<TToken extends AbstractType>(
    identifier: TToken,
    implementation: Type<InstanceType<TToken>>
  ): SociableTestBedBuilder<TClass>;
  public bind(
    identifier: InjectableIdentifier,
    implementation: Type
  ): SociableTestBedBuilder<TClass> {
    this.setExposedBinding(identifier, implementation);
    return this;
  }

  public override mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, SociableTestBedBuilder<TClass>> {
    return this.createMockOverride(identifier, identifierMetadata, this);
  }

  public compose(): ComposedSociableTestBedBuilder<TClass> {
    const composed = new ComposedSociableTestBedBuilder<TClass>(
      this.doublesAdapter,
      this.unitMocker,
      this.targetClass,
      this.logger
    );
    this.copyConfigurationTo(composed);
    return composed;
  }
}

class ComposedSociableTestBedBuilder<TClass>
  extends SociableBuilderBase<TClass>
  implements ComposedTestBedBuilder<TClass>
{
  public bind<TDependency>(
    identifier: string | symbol,
    implementation: Type<TDependency>
  ): ComposedTestBedBuilder<TClass>;
  public bind<TToken extends AbstractType>(
    identifier: TToken,
    implementation: Type<InstanceType<TToken>>
  ): ComposedTestBedBuilder<TClass>;
  public bind(
    identifier: InjectableIdentifier,
    implementation: Type
  ): ComposedTestBedBuilder<TClass> {
    this.setExposedBinding(identifier, implementation);
    return this;
  }

  public override mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, ComposedTestBedBuilder<TClass>> {
    return this.createMockOverride(identifier, identifierMetadata, this);
  }

  protected resolverOptions(boundaries: CompositionBoundaryContainer): ResolverOptions {
    return {
      compose: true,
      boundaries,
      exposedBindings: this.exposedBindings,
      guardUndeclared: true,
    };
  }
}

class SelectiveSociableTestBedBuilder<TClass>
  extends SociableBuilderBase<TClass>
  implements SelectiveTestBedBuilder<TClass>
{
  public bind<TDependency>(
    identifier: string | symbol,
    implementation: Type<TDependency>
  ): SelectiveTestBedBuilder<TClass>;
  public bind<TToken extends AbstractType>(
    identifier: TToken,
    implementation: Type<InstanceType<TToken>>
  ): SelectiveTestBedBuilder<TClass>;
  public bind(
    identifier: InjectableIdentifier,
    implementation: Type
  ): SelectiveTestBedBuilder<TClass> {
    this.setExposedBinding(identifier, implementation);
    return this;
  }

  public expose(
    dependency: Type,
    ...dependencies: Type[]
  ): SelectiveSociableTestBedBuilder<TClass> {
    if (!dependency) {
      throw new TypeError('Selective exposure requires at least one dependency');
    }

    const selective = new SelectiveSociableTestBedBuilder<TClass>(
      this.doublesAdapter,
      this.unitMocker,
      this.targetClass,
      this.logger
    );
    this.copyConfigurationTo(selective, [dependency, ...dependencies]);
    return selective;
  }

  public override mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    identifierMetadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, SelectiveTestBedBuilder<TClass>> {
    return this.createMockOverride(identifier, identifierMetadata, this);
  }

  protected resolverOptions(): ResolverOptions {
    return { exposedBindings: this.exposedBindings, guardUndeclared: true };
  }
}
