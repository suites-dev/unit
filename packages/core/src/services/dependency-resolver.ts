import { isDeepStrictEqual } from 'node:util';
import { DependencyResolutionError, SuitesError, SuitesErrorCode } from '@suites/types.common';
import type { AbstractType, FinalValue, Type } from '@suites/types.common';
import type { MockFunction, StubbedInstance } from '@suites/types.doubles';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  IdentifierMetadata,
  InjectableIdentifier,
  InjectableRegistry,
  InspectionFailure,
  InspectionResult,
} from '@suites/types.di';
import { UndefinedDependencyError, UndefinedTokenError } from '@suites/types.di';
import type { CompositionBoundaryLookup, DependencyPathEntry } from './composition-boundary.js';
import type { DependencyContainer, IdentifierToMockOrFinal } from './dependency-container.js';
import { createGuardedDependency } from './guarded-dependency.js';
import { DependencyMap } from './dependency-map.js';

export type ResolverOptions =
  | { readonly mode: 'solitary' }
  | { readonly mode: 'selective'; readonly bindings: ReadonlyMap<InjectableIdentifier, Type> }
  | {
      readonly mode: 'composed';
      readonly bindings: ReadonlyMap<InjectableIdentifier, Type>;
      readonly boundaries: CompositionBoundaryLookup;
    };

type ResolvedDependency = Type | FinalValue | StubbedInstance<unknown>;
type ResolvedBoundary = { value: ResolvedDependency };

function validFailure(result: InspectionResult, target: Type): result is InspectionFailure {
  if (result?.kind !== 'failure' || result.target !== target || !('cause' in result)) return false;
  const { reason, location } = result;
  if (
    reason !== 'undefined-dependency' &&
    reason !== 'undefined-token' &&
    reason !== 'invalid-metadata' &&
    reason !== 'unsupported-token'
  )
    return false;
  switch (location?.kind) {
    case 'class':
      return true;
    case 'parameter':
      return Number.isInteger(location.index) && location.index >= 0;
    case 'property':
      return typeof location.key === 'string' || typeof location.key === 'symbol';
    default:
      return false;
  }
}

export class DependencyResolver {
  private readonly inspected = new Map<Type, InjectableRegistry>();
  private readonly dependencyMap = new DependencyMap();
  private readonly usedMockEntries = new Set<IdentifierToMockOrFinal>();
  private readonly availableClassesToExpose = new Set<InjectableIdentifier>();
  private readonly constructionPath: DependencyPathEntry[] = [];
  private readonly exposedDependencies: IdentifierToMockOrFinal[0][] = [];
  private readonly composedDependencies: IdentifierToMockOrFinal[0][] = [];

  constructor(
    private readonly classesToExpose: readonly Type[],
    private readonly mockedFromBeforeContainer: DependencyContainer,
    private readonly adapter: DependencyInjectionAdapter,
    private readonly mockFunction: MockFunction,
    private readonly options: ResolverOptions = { mode: 'solitary' },
    private readonly root: Type | undefined = undefined
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

    return this.adapter.canAutoConstruct?.(identifier as Type) === true;
  }

  private resolveBoundary(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): ResolvedBoundary | undefined {
    const boundary =
      this.options.mode === 'composed'
        ? this.options.boundaries.resolve(identifier, metadata)
        : undefined;
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

    if (
      metadata === undefined &&
      this.options.mode !== 'solitary' &&
      this.options.bindings.has(identifier)
    ) {
      return undefined;
    }

    const existingEntry = this.mockedFromBeforeContainer.resolveEntry(identifier, metadata);
    if (existingEntry !== undefined) {
      this.usedMockEntries.add(existingEntry);
      return { value: existingEntry[1] };
    }

    return undefined;
  }

  private inspect(target: Type) {
    const registry = this.inspected.get(target);
    if (registry) return registry;
    const result = this.adapter.inspect(target);
    if (
      result?.kind === 'success' &&
      typeof result.registry?.list === 'function' &&
      typeof result.registry.resolve === 'function'
    ) {
      this.inspected.set(target, result.registry);
      return result.registry;
    }
    if (!validFailure(result, target)) {
      throw new SuitesError(
        SuitesErrorCode.ADAPTER_ERROR,
        'Invalid DI adapter inspection result',
        'Update your DI adapter for v5. inspect() must return an InspectionResult containing a registry or a reflection failure.'
      );
    }

    const { location, reason } = result;
    const slot =
      location.kind === 'parameter'
        ? `dependency at index [${location.index}]`
        : location.kind === 'property'
          ? `dependency for property '${String(location.key)}'`
          : 'constructor dependencies';
    const root = this.root ?? target;
    const detail = `Cannot resolve ${slot} in '${target.name}' while constructing '${root.name}'.`;
    const context = { root, failure: result };
    if (reason === 'undefined-token') {
      throw new UndefinedTokenError(
        `${detail} Check the declared token and any lazy reference.`,
        context
      );
    }
    const advice =
      reason === 'unsupported-token'
        ? 'Use a dependency token supported by the installed adapter.'
        : 'Check the injection decorator and emitted metadata. Use @Inject(token) in NestJS or InjectionJS, or @inject(token) in InversifyJS, for an erased constructor type.';
    throw new UndefinedDependencyError(`${detail} ${advice}`, context);
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
      this.dependencyMap.set(identifier, boundary.value, metadata);
      return boundary.value;
    }

    const implementation =
      this.options.mode === 'solitary' ? undefined : this.options.bindings.get(identifier);
    if (implementation !== undefined) {
      const instance = this.instantiateClass(implementation, metadata, identifier);
      this.exposedDependencies.push({ identifier, metadata });
      return instance;
    }

    if (this.options.mode === 'composed' && this.isComposableClass(identifier)) {
      const instance = this.instantiateClass(identifier, metadata);
      this.composedDependencies.push({ identifier, metadata });
      return instance;
    }

    if (this.options.mode !== 'solitary' && !this.isExposedClass(identifier)) {
      const guard = createGuardedDependency('undeclared dependency', identifier, metadata, [
        ...this.constructionPath,
        { identifier, metadata },
      ]);
      this.dependencyMap.set(identifier, guard, metadata);
      return guard;
    }

    if (this.isExposedClass(identifier)) return this.instantiateClass(identifier, metadata);
    const mock = this.mockFunction();
    this.dependencyMap.set(identifier, mock, metadata);
    return mock;
  }

  public instantiateClass(
    type: Type,
    metadata: IdentifierMetadata | undefined = undefined,
    identifier: InjectableIdentifier = type
  ): ResolvedDependency {
    if (this.dependencyMap.has(identifier, metadata)) {
      return this.dependencyMap.get(identifier, metadata) as ResolvedDependency;
    }

    const tracksCycles = this.options.mode !== 'solitary';
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
      const injectableRegistry = this.inspect(type);

      injectableRegistry.list().forEach((injectable: ClassInjectable) => {
        this.availableClassesToExpose.add(injectable.identifier);
      });

      const ctorInjectables = injectableRegistry.list().filter(({ type }) => type === 'PARAM');
      const ctorParams = ctorInjectables.map((injectable) =>
        this.resolveOrMock(
          injectable.identifier,
          'metadata' in injectable ? injectable.metadata : undefined
        )
      );

      const instance = new type(...ctorParams);
      this.dependencyMap.set(identifier, instance, metadata);

      const propsInjectables = injectableRegistry.list().filter(({ type }) => type === 'PROPERTY');
      propsInjectables.forEach((injectable) => {
        instance[injectable.property!.key] = this.resolveOrMock(
          injectable.identifier,
          'metadata' in injectable ? injectable.metadata : undefined
        );
      });

      return instance;
    } finally {
      if (tracksCycles) {
        this.constructionPath.pop();
      }
    }
  }

  public getExposedDependencies(): IdentifierToMockOrFinal[0][] {
    return this.exposedDependencies;
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
