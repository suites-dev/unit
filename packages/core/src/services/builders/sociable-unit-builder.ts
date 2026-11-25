import type { FinalValue, Type } from '@suites/types.common';
import type { DoublesAdapter, StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { MockOverride, UnitTestBed } from '../../types.js';
import type { IdentifierToFinal, IdentifierToMockOrFinal } from '../dependency-container.js';
import { normalizeIdentifier } from '../../normalize-identifier.static.js';
import { DependencyContainer } from '../dependency-container.js';
import type { ResolverOptions } from '../dependency-resolver.js';
import { CompositionBoundaryContainer, type CompositionBoundary } from '../composition-boundary.js';
import { UnitReference } from '../unit-reference.js';
import type { UnitMocker } from '../unit-mocker.js';

export interface SociableTestBedBuilderState<TClass, TMode extends 'selective' | 'composed'> {
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    metadata?: IdentifierMetadata
  ): MockOverride<TDependency, TClass, SociableTestBedBuilderState<TClass, TMode>>;
  compile(): Promise<UnitTestBed<TClass>>;
}

interface BuilderContext<TClass> {
  readonly doubles: Promise<DoublesAdapter>;
  readonly mocker: UnitMocker;
  readonly targetClass: Type<TClass>;
  readonly logger: Pick<Console, 'warn'>;
}

type ConstructionMode =
  { readonly kind: 'selective'; readonly classes: readonly Type[] } | { readonly kind: 'composed' };

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
  readonly mode: ConstructionMode;
  readonly overrides: readonly Override[];
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

    return configuredBuilder(this.#context, {
      mode: { kind: 'selective', classes: [first, ...rest] },
      overrides: [],
    });
  }

  public compose(): SociableTestBedBuilderState<TClass, 'composed'> {
    return configuredBuilder(this.#context, { mode: { kind: 'composed' }, overrides: [] });
  }
}

function configuredBuilder<TClass, TMode extends 'selective' | 'composed'>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration
): SociableTestBedBuilderState<TClass, TMode> {
  const withOverride = (override: Override) =>
    configuredBuilder<TClass, TMode>(context, {
      ...configuration,
      overrides: [...configuration.overrides, override],
    });

  return {
    mock(identifier, metadata) {
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
    compile: () => compile(context, configuration),
  };
}

async function compile<TClass>(
  context: BuilderContext<TClass>,
  configuration: SociableConfiguration
): Promise<UnitTestBed<TClass>> {
  const doubles = await context.doubles;
  const entries: IdentifierToMockOrFinal[] = [];
  const finalized: IdentifierToFinal[] = [];
  const boundaries: CompositionBoundary[] = [];

  for (const override of configuration.overrides) {
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

  const { mode } = configuration;
  const classes = mode.kind === 'selective' ? mode.classes : [];
  const options = (
    mode.kind === 'selective'
      ? { mode: 'selective' }
      : { mode: 'composed', boundaries: new CompositionBoundaryContainer(boundaries) }
  ) satisfies ResolverOptions;
  const { container, instance, resolution, composedDependencies } =
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
    unitRef: new UnitReference(container, classes, finalized, composedDependencies),
  };
}
