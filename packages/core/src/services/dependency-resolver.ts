import type { FinalValue, Type, AbstractType } from '@suites/types.common';
import type { MockFunction, StubbedInstance } from '@suites/types.doubles';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  IdentifierMetadata,
  InjectableIdentifier,
  WithMetadata,
} from '@suites/types.di';
import type { DependencyContainer, IdentifierToMockOrFinal } from './dependency-container.js';
import { DependencyMap } from './dependency-map.js';

export class DependencyResolver {
  private readonly dependencyMap = new DependencyMap();
  private readonly availableClassesToExpose = new Set<AbstractType>();

  constructor(
    private readonly classesToExpose: Type[],
    private readonly mockedFromBeforeContainer: DependencyContainer,
    private readonly adapter: DependencyInjectionAdapter,
    private readonly mockFunction: MockFunction
  ) {}

  private isExposedClass(identifier: InjectableIdentifier): identifier is Type {
    // Only explicitly exposed, concrete constructors may be instantiated.
    return (
      typeof identifier === 'function' && this.classesToExpose.some((type) => type === identifier)
    );
  }

  public isLeafOrPrimitive(identifier: InjectableIdentifier): boolean {
    return (
      typeof identifier !== 'function' ||
      this.adapter.inspect(identifier as Type).list().length === 0
    );
  }

  public resolveOrMock(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): Type | FinalValue | StubbedInstance<unknown> {
    if (this.dependencyMap.has(identifier, metadata)) {
      return this.dependencyMap.get(identifier, metadata) as Type | FinalValue | ClassInjectable;
    }

    const existingMock = this.mockedFromBeforeContainer.resolve(identifier, metadata);

    if (existingMock !== undefined) {
      this.dependencyMap.set(identifier, existingMock, metadata as never);
      return existingMock;
    }

    if (this.isLeafOrPrimitive(identifier)) {
      if (this.dependencyMap.has(identifier, metadata)) {
        return this.dependencyMap.get(identifier, metadata) as
          Type | FinalValue | StubbedInstance<unknown>;
      }

      if (this.isExposedClass(identifier)) {
        return this.instantiateClass(identifier, metadata);
      }

      const mock = this.mockFunction();
      this.dependencyMap.set(identifier, mock, metadata as never);
      return mock;
    }

    // Non-leaf classes that are not exposed should also be mocked
    if (typeof identifier === 'function' && !this.isExposedClass(identifier)) {
      const mock = this.mockFunction();
      this.dependencyMap.set(identifier, mock, metadata as never);

      return mock as StubbedInstance<unknown>;
    }

    // Instantiate class if it's not a leaf or primitive
    return this.instantiateClass(identifier as Type, metadata);
  }

  public instantiateClass(
    type: Type,
    metadata: IdentifierMetadata | undefined = undefined
  ): Type | FinalValue | StubbedInstance<unknown> {
    if (this.dependencyMap.has(type, metadata)) {
      return this.dependencyMap.get(type, metadata) as Type | FinalValue | StubbedInstance<unknown>;
    }

    const injectableRegistry = this.adapter.inspect(type);

    injectableRegistry.list().forEach((injectable: ClassInjectable) => {
      if (typeof injectable.identifier === 'function') {
        this.availableClassesToExpose.add(injectable.identifier);
      }
    });

    const ctorInjectables = injectableRegistry.list().filter(({ type }) => type === 'PARAM');

    const ctorParams = ctorInjectables.map(({ identifier, metadata }: WithMetadata<never>) => {
      return this.resolveOrMock(identifier, metadata);
    });

    const instance = new type(...ctorParams);
    this.dependencyMap.set(type, instance, metadata as never);

    const propsInjectables = injectableRegistry.list().filter(({ type }) => type === 'PROPERTY');

    propsInjectables.forEach(({ identifier, metadata, property }: WithMetadata<never>) => {
      const propValue = this.resolveOrMock(identifier, metadata);
      instance[property!.key] = propValue;
    });

    return instance;
  }

  public getResolvedDependencies() {
    return this.dependencyMap.entries();
  }

  public getResolutionSummary(): {
    mocks: { metadata?: unknown; identifier: AbstractType }[];
    exposes: Type[];
    notFound: IdentifierToMockOrFinal[];
  } {
    const exposes = this.classesToExpose.filter((cls) => !this.availableClassesToExpose.has(cls));

    const mocks = this.mockedFromBeforeContainer
      .list()
      .filter(([injectable]) => typeof injectable.identifier === 'function')
      .filter(
        ([injectable]) => !this.availableClassesToExpose.has(injectable.identifier as AbstractType)
      );

    const notFound = this.mockedFromBeforeContainer.list().filter(([injectable]) => {
      return !this.dependencyMap.has(injectable.identifier, injectable.metadata as never);
    });

    return {
      notFound,
      mocks: mocks.map(([injectable]) => injectable) as {
        metadata?: unknown;
        identifier: AbstractType;
      }[],
      exposes,
    };
  }
}
