import { isDeepStrictEqual } from 'node:util';
import { DependencyResolutionError, SuitesErrorCode } from '@suites/types.common';
import type { AbstractType, FinalValue, Type } from '@suites/types.common';
import type { DoublesAdapter, StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { MockOverride, UnitTestBed } from '../../types.js';
import type { IdentifierToFinal } from '../dependency-container.js';
import { normalizeIdentifier } from '../../normalize-identifier.static.js';
import { DependencyContainer } from '../dependency-container.js';
import type { ResolverOptions } from '../dependency-resolver.js';
import { CompositionBoundaryContainer, type CompositionBoundary } from '../composition-boundary.js';
import { stringifyIdentifier } from '../functions.static.js';
import { createGuardedDependency } from '../guarded-dependency.js';
import { UnitReference } from '../unit-reference.js';
import type { UnitMocker } from '../unit-mocker.js';

type DependencyOf<TIdentifier> =
  TIdentifier extends AbstractType<infer TDependency>
    ? TDependency
    : TIdentifier extends InjectableIdentifier<infer TDependency>
      ? TDependency
      : never;

// A constructor's static properties can also match a registered structural token.
type NonClassIdentifier<T> = Exclude<InjectableIdentifier<T>, AbstractType> &
  Partial<Record<typeof Symbol.hasInstance, never>>;

interface ConfiguredBuilder<TClass, TSelf extends { compile(): Promise<UnitTestBed<TClass>> }> {
  bind<TIdentifier extends InjectableIdentifier>(
    identifier: TIdentifier,
    implementation: Type<DependencyOf<TIdentifier>>
  ): TSelf;
  bind<TDependency>(
    identifier: NonClassIdentifier<TDependency>,
    implementation: Type<TDependency>
  ): TSelf;
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    ...qualifier: [] | [metadata: IdentifierMetadata | undefined]
  ): MockOverride<TDependency, TClass, TSelf>;
  compile(): Promise<UnitTestBed<TClass>>;
}

export type SociableTestBedBuilderState<
  TClass,
  TMode extends 'selective' | 'composed',
> = ConfiguredBuilder<TClass, SociableTestBedBuilderState<TClass, TMode>> & {
  /** Stop recursive construction at each identifier and fail the test file on access. */
  [Method in TMode extends 'composed' ? 'forbid' : never]: (
    identifier: InjectableIdentifier,
    ...rest: InjectableIdentifier[]
  ) => SociableTestBedBuilderState<TClass, 'composed'>;
};

interface BuilderContext<TClass> {
  readonly doubles: Promise<DoublesAdapter>;
  readonly mocker: UnitMocker;
  readonly targetClass: Type<TClass>;
}

type ConstructionMode =
  | { readonly kind: 'selective'; readonly classes: readonly Type[] }
  | { readonly kind: 'composed'; readonly forbidden: readonly InjectableIdentifier[] };

type Override = (
  | {
      readonly kind: 'mock';
      readonly create: (doubles: DoublesAdapter) => StubbedInstance<unknown>;
    }
  | { readonly kind: 'final'; readonly value: FinalValue }
) & {
  readonly identifier: InjectableIdentifier;
  readonly metadata: IdentifierMetadata | undefined;
};

interface SociableConfiguration {
  readonly overrides: readonly Override[];
  readonly bindings: readonly {
    readonly identifier: InjectableIdentifier;
    readonly implementation: Type;
  }[];
}

export class SociableTestBedBuilder<TClass> {
  readonly #context: BuilderContext<TClass>;

  constructor(
    doubles: Promise<DoublesAdapter>,
    mocker: UnitMocker,
    targetClass: Type<TClass>,
    logger: Pick<Console, 'warn'>
  );
  constructor(doubles: Promise<DoublesAdapter>, mocker: UnitMocker, targetClass: Type<TClass>) {
    this.#context = { doubles, mocker, targetClass };
  }

  public expose(first: Type, ...rest: Type[]): SociableTestBedBuilderState<TClass, 'selective'> {
    if (first === undefined) {
      throw new InvalidBuilderArgument('Selective exposure requires at least one dependency');
    }
    if (![first, ...rest].every(isConstructor)) {
      throw new InvalidBuilderArgument('Each exposed dependency must be a concrete class.');
    }

    const mode = { kind: 'selective', classes: [first, ...rest] } satisfies ConstructionMode;
    const next = (
      config: SociableConfiguration
    ): SociableTestBedBuilderState<TClass, 'selective'> =>
      configuredBuilder(this.#context, config, mode, next);
    return next({ overrides: [], bindings: [] });
  }

  public compose(): SociableTestBedBuilderState<TClass, 'composed'> {
    return composedBuilder(this.#context, { overrides: [], bindings: [] }, []);
  }
}

function composedBuilder<TClass>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration,
  forbidden: readonly InjectableIdentifier[]
): SociableTestBedBuilderState<TClass, 'composed'> {
  const mode = { kind: 'composed', forbidden } satisfies ConstructionMode;
  return {
    ...configuredBuilder(context, configuration, mode, (next) =>
      composedBuilder(context, next, forbidden)
    ),
    forbid(identifier, ...rest) {
      if (identifier === undefined) {
        throw new InvalidBuilderArgument(
          'A forbidden composition boundary requires at least one identifier'
        );
      }
      for (const token of [identifier, ...rest]) requireIdentifier(token, 'forbid');
      return composedBuilder(context, configuration, [...forbidden, identifier, ...rest]);
    },
  };
}

function configuredBuilder<TClass, TSelf extends { compile(): Promise<UnitTestBed<TClass>> }>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration,
  mode: ConstructionMode,
  next: (configuration: SociableConfiguration) => TSelf
): ConfiguredBuilder<TClass, TSelf> {
  const withOverride = (override: Override) =>
    next({
      ...configuration,
      overrides: [...configuration.overrides, override],
    });

  return {
    bind(identifier: InjectableIdentifier, implementation: Type) {
      requireIdentifier(identifier, 'bind');
      if (!isConstructor(implementation)) {
        throw new InvalidBuilderArgument(
          `Binding a dependency token requires a concrete implementation for ${stringifyIdentifier(identifier, undefined)}.`
        );
      }
      return next({
        ...configuration,
        bindings: [...configuration.bindings, { identifier, implementation }],
      });
    },
    mock(identifier, ...[metadata]) {
      requireIdentifier(identifier, 'mock');
      return {
        impl: (implementation) => {
          if (typeof implementation !== 'function') {
            throw new InvalidBuilderArgument('An implemented mock requires a factory function.');
          }
          return withOverride({
            kind: 'mock',
            identifier,
            metadata,
            create: (doubles) => doubles.mock(implementation(doubles.stub)),
          });
        },
        final: (value) => withOverride({ kind: 'final', identifier, metadata, value }),
      };
    },
    compile: () => compile(context, configuration, mode),
  };
}

class InvalidBuilderArgument extends TypeError {
  public readonly code = SuitesErrorCode.INVALID_BUILDER_ARGUMENT;
  public readonly severity = 'error';

  public constructor(message: string) {
    super(
      `Invalid builder argument (code ${SuitesErrorCode.INVALID_BUILDER_ARGUMENT})\n${message}`
    );
  }
}

function requireIdentifier(identifier: InjectableIdentifier, method: string): void {
  if (identifier === null || identifier === undefined) {
    throw new InvalidBuilderArgument(`.${method}() requires a dependency identifier.`);
  }
}

// The construct trap tests the candidate's [[Construct]] without invoking consumer code.
function isConstructor(value: unknown): boolean {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(new Proxy(value, { construct: () => ({}) }), []);
    return true;
  } catch {
    return false;
  }
}

function conflict(message: string): never {
  throw new DependencyResolutionError(message, SuitesErrorCode.CONFIGURATION_CONFLICT);
}

function collectBindings(
  configuration: SociableConfiguration
): ReadonlyMap<InjectableIdentifier, Type> {
  const bindings = new Map<InjectableIdentifier, Type>();
  for (const { identifier, implementation } of configuration.bindings) {
    const existing = bindings.get(identifier);
    if (existing !== undefined && existing !== implementation) {
      conflict(
        `Conflicting bindings for ${stringifyIdentifier(identifier, undefined)}: ` +
          `${stringifyIdentifier(existing, undefined)} and ${stringifyIdentifier(implementation, undefined)}. Bind each token to one implementation.`
      );
    }
    bindings.set(identifier, implementation);
  }
  return bindings;
}

function validateOverrides(
  overrides: readonly Override[],
  bindings: ReadonlyMap<InjectableIdentifier, Type>
): void {
  const declared = new Map<InjectableIdentifier, Override[]>();
  for (const override of overrides) {
    const { identifier, metadata } = override;
    const matches = declared.get(identifier) ?? [];
    const previous = matches.find((entry) => isDeepStrictEqual(entry.metadata, metadata));
    if (previous !== undefined) {
      conflict(
        `Conflicting ${previous.kind} and ${override.kind} declarations for ${stringifyIdentifier(identifier, metadata)}. Declare one override per qualifier.`
      );
    }
    if (metadata === undefined && bindings.has(identifier)) {
      conflict(
        `Conflicting declarations for ${stringifyIdentifier(identifier, metadata)}. Choose either a binding or an unqualified override for this token.`
      );
    }
    matches.push(override);
    declared.set(identifier, matches);
  }
}

async function compile<TClass>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration,
  mode: ConstructionMode
): Promise<UnitTestBed<TClass>> {
  const bindings = collectBindings(configuration);
  validateOverrides(configuration.overrides, bindings);
  const boundaries: CompositionBoundary[] = [];
  if (mode.kind === 'composed') {
    for (const identifier of new Set(mode.forbidden)) {
      const override = configuration.overrides.find((entry) => entry.identifier === identifier);
      if (bindings.has(identifier) || override !== undefined) {
        const name = stringifyIdentifier(identifier, override?.metadata);
        conflict(
          `Conflicting dependency declarations for ${name}. Remove either the forbid or the ${override?.kind ?? 'binding'} declaration.`
        );
      }
      boundaries.push({
        kind: 'guard',
        identifier,
        metadata: undefined,
        create: (path) =>
          createGuardedDependency(
            'forbidden dependency',
            identifier,
            path[path.length - 1].metadata,
            path
          ),
      });
    }
  }

  const doubles = await context.doubles;
  const pending = new Set(configuration.overrides);
  const finalized: IdentifierToFinal[] = [];
  for (const override of configuration.overrides) {
    let mock: StubbedInstance<unknown> | undefined;
    boundaries.push({
      kind: 'override',
      identifier: override.identifier,
      metadata: override.metadata,
      create: (path) => {
        pending.delete(override);
        if (override.kind === 'final') {
          const { identifier, metadata } = path[path.length - 1];
          finalized.push([normalizeIdentifier(identifier, metadata), override.value]);
          return override.value;
        }
        return (mock ??= override.create(doubles));
      },
    });
  }

  const classes = mode.kind === 'selective' ? mode.classes : [];
  const options = {
    mode: mode.kind,
    bindings,
    boundaries: new CompositionBoundaryContainer(boundaries),
  } satisfies ResolverOptions;
  const { container, instance, resolution, composedDependencies, exposedDependencies } =
    await context.mocker.constructUnit(
      context.targetClass,
      classes,
      new DependencyContainer([]),
      options
    );

  const unreachable = Array.from(
    pending,
    ({ kind, identifier, metadata }) => `${kind} ${stringifyIdentifier(identifier, metadata)}`
  );
  for (const identifier of new Set(resolution.exposes)) {
    unreachable.push(`exposure ${stringifyIdentifier(identifier, undefined)}`);
  }
  for (const identifier of bindings.keys()) {
    if (!exposedDependencies.some((entry) => entry.identifier === identifier)) {
      unreachable.push(`binding ${stringifyIdentifier(identifier, undefined)}`);
    }
  }
  if (unreachable.length > 0) {
    throw new DependencyResolutionError(
      `Unreachable declarations in the ${mode.kind} graph of ${stringifyIdentifier(context.targetClass, undefined)}: ${unreachable.join('; ')}. Remove these declarations or include their dependent classes in the graph.`,
      SuitesErrorCode.UNREACHABLE_DECLARATION
    );
  }

  return {
    unit: instance,
    unitRef: new UnitReference(container, [], finalized, composedDependencies, exposedDependencies),
  };
}
