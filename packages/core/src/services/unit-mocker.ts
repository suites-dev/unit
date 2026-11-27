import type { MockFunction } from '@suites/types.doubles';
import type { DependencyInjectionAdapter } from '@suites/types.di';
import type { IdentifierToMockOrFinal } from './dependency-container.js';
import { DependencyContainer } from './dependency-container.js';
import type { Type, AbstractType } from '@suites/types.common';
import type { ResolverOptions } from './dependency-resolver.js';
import { DependencyResolver } from './dependency-resolver.js';

export interface MockedUnit<TClass> {
  container: DependencyContainer;
  instance: TClass;
  composedDependencies: IdentifierToMockOrFinal[0][];
  exposedDependencies: IdentifierToMockOrFinal[0][];
  resolution: {
    notFound: IdentifierToMockOrFinal[];
    mocks: { metadata?: unknown; identifier: AbstractType }[];
    exposes: Type[];
  };
}

export class UnitMocker {
  public constructor(
    private readonly mockFunction: PromiseLike<MockFunction>,
    private readonly diAdapter: PromiseLike<DependencyInjectionAdapter>
  ) {}

  public async constructUnit<TClass>(
    targetClass: Type<TClass>,
    classesToExpose: readonly Type[],
    mockContainer: DependencyContainer,
    resolverOptions?: ResolverOptions
  ): Promise<MockedUnit<TClass>> {
    const dependencyResolver = new DependencyResolver(
      classesToExpose,
      mockContainer,
      await this.diAdapter,
      await this.mockFunction,
      resolverOptions,
      targetClass
    );

    const instance = dependencyResolver.instantiateClass(targetClass);

    const identifierToDependency = Array.from(dependencyResolver.getResolvedDependencies())
      .map(([identifier, value]) => [identifier, value] as IdentifierToMockOrFinal)
      .filter(([{ identifier }]) => identifier !== targetClass);

    return {
      container: new DependencyContainer(identifierToDependency),
      instance: instance as TClass,
      resolution: dependencyResolver.getResolutionSummary(),
      composedDependencies: dependencyResolver.getComposedDependencies(),
      exposedDependencies: dependencyResolver.getExposedDependencies(),
    };
  }
}
