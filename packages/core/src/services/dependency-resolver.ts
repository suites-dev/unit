import { isDeepStrictEqual } from 'node:util';
import { DependencyResolutionError } from '@suites/types.common';
import type { AbstractType, FinalValue, Type } from '@suites/types.common';
import type { MockFunction, StubbedInstance } from '@suites/types.doubles';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  IdentifierMetadata,
  InjectableIdentifier,
  WithMetadata,
} from '@suites/types.di';
import type { CompositionBoundaryLookup, DependencyPathEntry } from './composition-boundary.js';
import type { DependencyContainer, IdentifierToMockOrFinal } from './dependency-container.js';
import { DependencyMap } from './dependency-map.js';

export interface ResolverOptions {
  compose?: boolean;
  boundaries?: CompositionBoundaryLookup;
  exposedBindings?: ReadonlyMap<InjectableIdentifier, Type>;
}

type ResolvedDependency = Type | FinalValue | StubbedInstance<unknown>;
type ResolvedBoundary = { value: ResolvedDependency };

export class DependencyResolver {
  private readonly dependencyMap = new DependencyMap();
  private readonly usedMockEntries = new Set<IdentifierToMockOrFinal>();
  private readonly availableClassesToExpose = new Set<InjectableIdentifier>();
  private readonly constructionPath: DependencyPathEntry[] = [];
  private readonly composedDependencies: IdentifierToMockOrFinal[0][] = [];

  constructor(
    private readonly classesToExpose: Type[],
    private readonly mockedFromBeforeContainer: DependencyContainer,
    private readonly adapter: DependencyInjectionAdapter,
    private readonly mockFunction: MockFunction,
    private readonly options: ResolverOptions = {}
  ) {}

  private isExposedClass(identifier: InjectableIdentifier): identifier is Type {
    return (
      typeof identifier === 'function' && this.classesToExpose.some((type) => type === identifier)
    );
  }

  private isComposableClass(identifier: InjectableIdentifier): identifier is Type {
    if (typeof identifier !== 'function') {
      return false;
    }

    return this.adapter.isConstructable?.(identifier as Type) === true;
  }

  private resolveBoundary(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): ResolvedBoundary | undefined {
    const boundary = this.options.boundaries?.resolve(identifier, metadata);
    if (boundary !== undefined) {
      if (boundary.kind === 'guard') {
        return {
          value: boundary.create([...this.constructionPath, { identifier, metadata }]),
        };
      }

      const selectedEntry = this.mockedFromBeforeContainer.resolveEntry(
        identifier,
        boundary.metadata
      );
      if (selectedEntry !== undefined) {
        this.usedMockEntries.add(selectedEntry);
      }
      return { value: boundary.value };
    }

    const existingEntry = this.mockedFromBeforeContainer.resolveEntry(identifier, metadata);
    if (existingEntry !== undefined) {
      this.usedMockEntries.add(existingEntry);
      return { value: existingEntry[1] };
    }

    return undefined;
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
  ): ResolvedDependency {
    if (this.dependencyMap.has(identifier, metadata)) {
      return this.dependencyMap.get(identifier, metadata) as ResolvedDependency;
    }

    const boundary = this.resolveBoundary(identifier, metadata);
    if (boundary !== undefined) {
      this.dependencyMap.set(identifier, boundary.value, metadata as never);
      return boundary.value;
    }

    const exposedImplementation = this.options.exposedBindings?.get(identifier);
    if (exposedImplementation !== undefined) {
      const instance = this.instantiateClass(exposedImplementation, metadata, identifier);
      if (this.options.compose) {
        this.composedDependencies.push({ identifier, metadata });
      }
      return instance;
    }

    if (this.options.compose && this.isComposableClass(identifier)) {
      const instance = this.instantiateClass(identifier, metadata);
      this.composedDependencies.push({ identifier, metadata });
      return instance;
    }

    if (this.isLeafOrPrimitive(identifier)) {
      if (this.isExposedClass(identifier)) {
        return this.instantiateClass(identifier, metadata);
      }

      const mock = this.mockFunction();
      this.dependencyMap.set(identifier, mock, metadata as never);
      return mock;
    }

    if (typeof identifier === 'function' && !this.isExposedClass(identifier)) {
      const mock = this.mockFunction();
      this.dependencyMap.set(identifier, mock, metadata as never);
      return mock;
    }

    return this.instantiateClass(identifier as Type, metadata);
  }

  public instantiateClass(
    type: Type,
    metadata: IdentifierMetadata | undefined = undefined,
    identifier: InjectableIdentifier = type
  ): ResolvedDependency {
    if (this.dependencyMap.has(identifier, metadata)) {
      return this.dependencyMap.get(identifier, metadata) as ResolvedDependency;
    }

    const tracksCycles = this.options.compose || (this.options.exposedBindings?.size ?? 0) > 0;
    if (
      tracksCycles &&
      this.constructionPath.some(
        (entry) => entry.identifier === identifier && isDeepStrictEqual(entry.metadata, metadata)
      )
    ) {
      const path = [...this.constructionPath, { identifier, metadata }]
        .map(({ identifier: pathIdentifier }) =>
          typeof pathIdentifier === 'function' ? pathIdentifier.name : String(pathIdentifier)
        )
        .join(' -> ');
      throw new DependencyResolutionError(
        `Cannot compose circular constructor dependencies: ${path}. Declare an explicit dependency boundary to stop traversal.`
      );
    }

    if (tracksCycles) {
      this.constructionPath.push({ identifier, metadata });
    }

    try {
      const injectableRegistry = this.adapter.inspect(type);

      injectableRegistry.list().forEach((injectable: ClassInjectable) => {
        this.availableClassesToExpose.add(injectable.identifier);
      });

      const ctorInjectables = injectableRegistry.list().filter(({ type }) => type === 'PARAM');
      const ctorParams = ctorInjectables.map(
        ({ identifier: dependencyIdentifier, metadata: dependencyMetadata }: WithMetadata<never>) =>
          this.resolveOrMock(dependencyIdentifier, dependencyMetadata)
      );

      const instance = new type(...ctorParams);
      this.dependencyMap.set(identifier, instance, metadata as never);

      const propsInjectables = injectableRegistry.list().filter(({ type }) => type === 'PROPERTY');
      propsInjectables.forEach(
        ({
          identifier: dependencyIdentifier,
          metadata: dependencyMetadata,
          property,
        }: WithMetadata<never>) => {
          instance[property!.key] = this.resolveOrMock(
            dependencyIdentifier,
            dependencyMetadata as IdentifierMetadata
          );
        }
      );

      return instance;
    } finally {
      if (tracksCycles) {
        this.constructionPath.pop();
      }
    }
  }

  public getComposedDependencies(): IdentifierToMockOrFinal[0][] {
    return this.composedDependencies;
  }

  public getResolvedDependencies(): IdentifierToMockOrFinal[] {
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
    const notFound = this.mockedFromBeforeContainer
      .list()
      .filter((entry) => !this.usedMockEntries.has(entry));

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
