import { DependencyResolutionError } from '@suites/types.common';
import type { AbstractType, FinalValue, Type } from '@suites/types.common';
import type { DoublesAdapter, StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { MockOverride, UnitTestBed } from '../../types.js';
import type { IdentifierToFinal, IdentifierToMockOrFinal } from '../dependency-container.js';
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

type SelectiveBuilder<TClass> = ConfiguredBuilder<TClass, SelectiveBuilder<TClass>>;

interface ComposedBuilder<TClass> extends ConfiguredBuilder<TClass, ComposedBuilder<TClass>> {
  /** Stop recursive construction at each identifier and fail the test file on access. */
  forbid(
    identifier: InjectableIdentifier,
    ...rest: InjectableIdentifier[]
  ): ComposedBuilder<TClass>;
}

export type SociableTestBedBuilderState<
  TClass,
  TMode extends 'selective' | 'composed',
> = TMode extends 'composed' ? ComposedBuilder<TClass> : SelectiveBuilder<TClass>;

interface BuilderContext<TClass> {
  readonly doubles: Promise<DoublesAdapter>;
  readonly mocker: UnitMocker;
  readonly targetClass: Type<TClass>;
  readonly logger: Pick<Console, 'warn'>;
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

  public constructor(
    doubles: Promise<DoublesAdapter>,
    mocker: UnitMocker,
    targetClass: Type<TClass>,
    logger: Pick<Console, 'warn'>
  ) {
    this.#context = { doubles, mocker, targetClass, logger };
  }

  public expose(first: Type, ...rest: Type[]): SociableTestBedBuilderState<TClass, 'selective'> {
    if (!first) {
      throw new TypeError('Selective exposure requires at least one dependency');
    }

    const mode = { kind: 'selective', classes: [first, ...rest] } satisfies ConstructionMode;
    const next = (config: SociableConfiguration): SelectiveBuilder<TClass> =>
      configuredBuilder(this.#context, config, mode, next);
    return next({ overrides: [], bindings: [] });
  }

  public compose(): ComposedBuilder<TClass> {
    return composedBuilder(this.#context, { overrides: [], bindings: [] }, []);
  }
}

function composedBuilder<TClass>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration,
  forbidden: readonly InjectableIdentifier[]
): ComposedBuilder<TClass> {
  const mode = { kind: 'composed', forbidden } satisfies ConstructionMode;
  return {
    ...configuredBuilder(context, configuration, mode, (next) =>
      composedBuilder(context, next, forbidden)
    ),
    forbid(identifier, ...rest) {
      if (identifier === undefined) {
        throw new TypeError('A forbidden composition boundary requires at least one identifier');
      }
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
      if (typeof implementation !== 'function') {
        throw new TypeError('Binding a dependency token requires a concrete implementation');
      }
      return next({
        ...configuration,
        bindings: [...configuration.bindings, { identifier, implementation }],
      });
    },
    mock(identifier, ...[metadata]) {
      return {
        impl: (implementation) =>
          withOverride({
            kind: 'mock',
            identifier,
            metadata,
            create: (doubles) => doubles.mock(implementation(doubles.stub)),
          }),
        final: (value) => withOverride({ kind: 'final', identifier, metadata, value }),
      };
    },
    compile: () => compile(context, configuration, mode),
  };
}

async function compile<TClass>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration,
  mode: ConstructionMode
): Promise<UnitTestBed<TClass>> {
  const bindings = new Map<InjectableIdentifier, Type>();
  for (const { identifier, implementation } of configuration.bindings) {
    const existing = bindings.get(identifier);
    if (existing !== undefined && existing !== implementation) {
      throw new DependencyResolutionError(
        `Conflicting bindings for ${stringifyIdentifier(identifier, undefined)}: ` +
          `${existing.name} and ${implementation.name}. Bind each requested token to one implementation.`
      );
    }
    bindings.set(identifier, implementation);
  }

  for (const { identifier, metadata } of configuration.overrides) {
    if (metadata === undefined && bindings.has(identifier)) {
      throw new DependencyResolutionError(
        `Conflicting declarations for ${stringifyIdentifier(identifier, metadata)}: ` +
          'choose either a binding or an unqualified override for this token.'
      );
    }
  }

  const doubles = await context.doubles;
  const entries: IdentifierToMockOrFinal[] = [];
  const finalized: IdentifierToFinal[] = [];
  const boundaries: CompositionBoundary[] = [];

  if (mode.kind === 'composed') {
    for (const identifier of new Set(mode.forbidden)) {
      if (
        bindings.has(identifier) ||
        configuration.overrides.some((entry) => entry.identifier === identifier)
      ) {
        throw new DependencyResolutionError(
          `Conflicting dependency declarations for ${stringifyIdentifier(identifier, undefined)}. A composed dependency cannot be forbidden and also declared as real, mocked, or final.`
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

  const mocks = configuration.overrides.filter(({ kind }) => kind === 'mock');
  const finals = configuration.overrides.filter(({ kind }) => kind === 'final');
  for (const override of [...mocks, ...finals]) {
    const { identifier, metadata } = override;
    const key = normalizeIdentifier(identifier, metadata);
    if (override.kind === 'mock') {
      const value = override.create(doubles);
      entries.push([key, value]);
      boundaries.push({ kind: 'mock', identifier, metadata, value });
    } else {
      const entry: IdentifierToFinal = [key, override.value];
      entries.push(entry);
      finalized.push(entry);
      boundaries.push({ kind: 'final', identifier, metadata, value: override.value });
    }
  }

  const classes = mode.kind === 'selective' ? mode.classes : [];
  const options = (
    mode.kind === 'selective'
      ? { mode: 'selective', bindings }
      : { mode: 'composed', bindings, boundaries: new CompositionBoundaryContainer(boundaries) }
  ) satisfies ResolverOptions;
  const { container, instance, resolution, composedDependencies, exposedDependencies } =
    await context.mocker.constructUnit(
      context.targetClass,
      classes,
      new DependencyContainer(entries),
      options
    );

  resolution.mocks.forEach((identifier) => {
    context.logger.warn(`Suites Warning: Unreachable Mock Configuration Detected.
You attempted to mock '${identifier.identifier.name}', which is not directly involved in the current testing context of '${context.targetClass.name}'.
This mock will not affect the outcome of your tests because '${identifier.identifier.name}' is neither a direct dependency of the tested unit nor is it
among the dependencies explicitly exposed. If '${identifier.identifier.name}' does not influence the unit under test, consider removing this mock from your
setup to streamline your test configuration. However, if this mock is crucial, verify that all required dependencies are correctly exposed.
For detailed guidance on configuring sociable tests, please consult: https://suites.dev/docs.`);
  });

  resolution.exposes.forEach((identifier) => {
    context.logger.warn(`Suites Warning: Unreachable Exposed Dependency Detected.
The dependency '${identifier.name}' has been exposed but cannot be reached within the current testing context.
This typically occurs because '${identifier.name}' is not a direct dependency of the unit under test (${context.targetClass.name}) nor any
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
      classes,
      finalized,
      composedDependencies,
      exposedDependencies
    ),
  };
}
