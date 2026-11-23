import type { FinalValue, Type } from '@suites/types.common';
import type { DoublesAdapter, StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { UnitTestBed } from '../../types.js';
import type { IdentifierToMockOrFinal } from '../dependency-container.js';
import { DependencyContainer } from '../dependency-container.js';
import type { ResolverOptions } from '../dependency-resolver.js';
import { CompositionBoundaryContainer } from '../composition-boundary.js';
import { UnitReference } from '../unit-reference.js';
import type { UnitMocker } from '../unit-mocker.js';
import { TestBedBuilder } from './testbed-builder.js';

export interface SociableTestBedBuilder<TClass> {
  expose(dependency: Type): this;
  compose(): ComposedSociableTestBedBuilder<TClass>;
}

interface ComposedTestBedBuilder<TClass> extends TestBedBuilder<TClass> {
  expose(dependency: Type): this;
}

abstract class SociableBuilderBase<TClass> extends TestBedBuilder<TClass> {
  protected readonly classesToExpose: Type[] = [];
  protected readonly exposedBindings = new Map<InjectableIdentifier, Type>();

  public constructor(
    protected readonly doublesAdapter: Promise<DoublesAdapter>,
    protected readonly unitMocker: UnitMocker,
    protected readonly targetClass: Type<TClass>,
    protected readonly logger: Console
  ) {
    super();
  }

  protected abstract resolverOptions(boundaries: CompositionBoundaryContainer): ResolverOptions;

  protected copyConfigurationTo(builder: SociableBuilderBase<TClass>): void {
    builder.classesToExpose.push(...this.classesToExpose);
    this.exposedBindings.forEach((implementation, identifier) => {
      builder.exposedBindings.set(identifier, implementation);
    });
    builder.identifiersToBeMocked.push(...this.identifiersToBeMocked);
    builder.identifiersToBeFinalized.push(...this.identifiersToBeFinalized);
  }

  protected setExposedBinding(identifier: InjectableIdentifier, implementation: Type): void {
    this.exposedBindings.set(identifier, implementation);
  }

  public expose(dependency: Type): this {
    this.classesToExpose.push(dependency);
    return this;
  }

  public async compile(): Promise<UnitTestBed<TClass>> {
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

    const { container, instance, resolution, composedDependencies } =
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
        composedDependencies
      ),
    };
  }
}

export class SociableTestBedBuilder<TClass> extends SociableBuilderBase<TClass> {
  protected resolverOptions(): ResolverOptions {
    return { exposedBindings: this.exposedBindings };
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
  protected resolverOptions(boundaries: CompositionBoundaryContainer): ResolverOptions {
    return {
      compose: true,
      boundaries,
      exposedBindings: this.exposedBindings,
    };
  }
}
