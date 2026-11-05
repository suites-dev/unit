import type { MockFunction } from '@suites/types.doubles';
import type { DependencyInjectionAdapter } from '@suites/types.di';
import type { IdentifierToMockOrFinal } from './dependency-container.js';
import { DependencyContainer } from './dependency-container.js';
import type { Type, AbstractType } from '@suites/types.common';
import { DependencyResolver } from './dependency-resolver.js';
import { resolveAdapter } from '../adapter-provider.js';
import type { AdapterProvider } from '../adapter-provider.js';

export interface MockedUnit<TClass> {
  container: DependencyContainer;
  instance: TClass;
  resolution: {
    notFound: IdentifierToMockOrFinal[];
    mocks: { metadata?: unknown; identifier: AbstractType }[];
    exposes: Type[];
  };
}

/** Optional construction path; existing DI adapters keep their inspect contract. */
export interface UnitConstructionStrategy<TClass> {
  construct(targetClass: Type<TClass>): MockedUnit<TClass> | Promise<MockedUnit<TClass>>;
}

export interface UnitConstructionOptions<TClass> {
  strategy?: UnitConstructionStrategy<TClass>;
}

export class UnitMocker {
  public constructor(
    private readonly mockFunction: AdapterProvider<MockFunction>,
    private readonly diAdapter: AdapterProvider<DependencyInjectionAdapter>
  ) {}

  public async constructUnit<TClass>(
    targetClass: Type<TClass>,
    classesToExpose: Type[],
    mockContainer: DependencyContainer,
    options?: UnitConstructionOptions<TClass>
  ): Promise<MockedUnit<TClass>> {
    if (options?.strategy) {
      return options.strategy.construct(targetClass);
    }

    const dependencyResolver = new DependencyResolver(
      classesToExpose,
      mockContainer,
      await resolveAdapter(this.diAdapter),
      await resolveAdapter(this.mockFunction)
    );

    const instance = dependencyResolver.instantiateClass(targetClass);

    const identifierToDependency = Array.from(dependencyResolver.getResolvedDependencies())
      .map(([identifier, value]) => [identifier, value] as IdentifierToMockOrFinal)
      .filter(([{ identifier }]) => identifier !== targetClass);

    return {
      container: new DependencyContainer(identifierToDependency),
      instance: instance as TClass,
      resolution: dependencyResolver.getResolutionSummary(),
    };
  }
}
