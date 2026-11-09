import { isDeepStrictEqual } from 'node:util';
import { DependencyResolutionError } from '@suites/types.common';
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

/** Opt-in graph construction; omitted options retain the V4 resolver behavior. */
export interface ResolverOptions {
  compose?: boolean;
  exposedBindings?: ReadonlyMap<InjectableIdentifier, Type>;
  excludedIdentifiers?: readonly InjectableIdentifier[];
}

export class DependencyResolver {
  private readonly dependencyMap = new DependencyMap();
  private readonly availableClassesToExpose = new Set<InjectableIdentifier>();
  private readonly constructionPath: {
    identifier: InjectableIdentifier;
    metadata?: IdentifierMetadata;
  }[] = [];
  private readonly composedDependencies: IdentifierToMockOrFinal[0][] = [];
  private readonly exposedDependencies: IdentifierToMockOrFinal[0][] = [];

  constructor(
    private readonly classesToExpose: Type[],
    private readonly mockedFromBeforeContainer: DependencyContainer,
    private readonly adapter: DependencyInjectionAdapter,
    private readonly mockFunction: MockFunction,
    private readonly options: ResolverOptions = {}
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

    const implementation = this.options.exposedBindings?.get(identifier);
    if (implementation !== undefined) {
      const instance = this.instantiateClass(implementation, metadata, identifier);
      this.exposedDependencies.push({ identifier, metadata });
      return instance;
    }

    if (this.options.compose) {
      // Boundaries are checked before reflection: excluded constructors and their
      // dependencies must never execute merely to discover the graph.
      if (this.options.excludedIdentifiers?.some((excluded) => excluded === identifier)) {
        const mock = this.mockFunction();
        this.dependencyMap.set(identifier, mock, metadata as never);
        return mock;
      }

      if (typeof identifier === 'function') {
        const instance = this.instantiateClass(identifier as Type, metadata);
        this.composedDependencies.push({ identifier, metadata });
        return instance;
      }
    }

    if (this.isLeafOrPrimitive(identifier)) {
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
    metadata: IdentifierMetadata | undefined = undefined,
    identifier: InjectableIdentifier = type
  ): Type | FinalValue | StubbedInstance<unknown> {
    if (this.dependencyMap.has(identifier, metadata)) {
      return this.dependencyMap.get(identifier, metadata) as
        Type | FinalValue | StubbedInstance<unknown>;
    }

    const trackConstruction = this.options.compose || (this.options.exposedBindings?.size ?? 0) > 0;
    if (
      trackConstruction &&
      this.constructionPath.some(
        (entry) => entry.identifier === identifier && isDeepStrictEqual(entry.metadata, metadata)
      )
    ) {
      const path = [...this.constructionPath, { identifier, metadata }]
        .map(({ identifier: token }) => (typeof token === 'function' ? token.name : String(token)))
        .join(' -> ');
      throw new DependencyResolutionError(
        `Cannot compose circular constructor dependencies: ${path}. ` +
          'Exclude or explicitly mock one dependency to establish a construction boundary.'
      );
    }

    if (trackConstruction) this.constructionPath.push({ identifier, metadata });
    try {
      const injectableRegistry = this.adapter.inspect(type);

      injectableRegistry.list().forEach((injectable: ClassInjectable) => {
        this.availableClassesToExpose.add(injectable.identifier);
      });

      const ctorInjectables = injectableRegistry.list().filter(({ type }) => type === 'PARAM');

      const ctorParams = ctorInjectables.map(({ identifier, metadata }: WithMetadata<never>) => {
        return this.resolveOrMock(identifier, metadata);
      });

      const instance = new type(...ctorParams);
      this.dependencyMap.set(identifier, instance, metadata as never);

      const propsInjectables = injectableRegistry.list().filter(({ type }) => type === 'PROPERTY');

      propsInjectables.forEach(({ identifier, metadata, property }: WithMetadata<never>) => {
        const propValue = this.resolveOrMock(identifier, metadata);
        instance[property!.key] = propValue;
      });

      return instance;
    } finally {
      if (trackConstruction) this.constructionPath.pop();
    }
  }

  public getExposedDependencies(): IdentifierToMockOrFinal[0][] {
    return this.exposedDependencies;
  }

  public getComposedDependencies(): IdentifierToMockOrFinal[0][] {
    return this.composedDependencies;
  }

  public getResolvedDependencies() {
    return this.dependencyMap.entries();
  }

  public getResolutionSummary(): {
    mocks: { metadata?: unknown; identifier: AbstractType }[];
    exposes: Type[];
    exposedTokens: InjectableIdentifier[];
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
      exposedTokens: [...(this.options.exposedBindings?.keys() ?? [])].filter(
        (token) => !this.availableClassesToExpose.has(token)
      ),
    };
  }
}
