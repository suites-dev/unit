import type { Type } from '@suites/types.common';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  InjectableIdentifier,
} from '@suites/types.di';
import type { DependencyPathEntry } from './composition-boundary.js';
import { dependencyVerificationKey } from '../dependency-verification-internal.js';
import { CompositionBoundaryContainer } from './composition-boundary.js';
import { DependencyContainer } from './dependency-container.js';
import { isGuardedDependency } from './guarded-dependency.js';
import { DependencyResolver, type ResolverOptions } from './dependency-resolver.js';
import { SociableTestBedBuilder } from './builders/sociable-unit-builder.js';
import { UnitMocker } from './unit-mocker.js';

import { TestToken } from '../../__test__/test-token.js';

function registry(entries: [Type, ClassInjectable[]][]): DependencyInjectionAdapter {
  return {
    canAutoConstruct: (type: Type) => entries.some(([target]) => type === target),
    inspect: (type: Type) => ({
      list: () => entries.find(([target]) => type === target)?.[1] ?? [],
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
}

const parameter = (identifier: InjectableIdentifier, metadata?: unknown): ClassInjectable =>
  ({ identifier, metadata, type: 'PARAM' }) as ClassInjectable;
const primary = { named: 'primary' };
const secondary = { named: 'secondary' };

class Client {
  read(): string {
    return 'live';
  }
}

class Repository {
  constructor(readonly client: Client) {}
}

class Service {
  constructor(readonly repository: Repository) {}
}

const adapter = registry([
  [Service, [parameter(Repository)]],
  [Repository, [parameter(Client)]],
  [Client, []],
]);

const composed = {
  mode: 'composed',
  bindings: new Map(),
  boundaries: new CompositionBoundaryContainer([]),
} satisfies ResolverOptions;

function resolver(options: ResolverOptions = { mode: 'solitary' }) {
  return new DependencyResolver(
    [],
    new DependencyContainer([]),
    adapter,
    jest.fn(() => ({})),
    options
  );
}

function createBuilder<TClass>(target: Type<TClass>, currentAdapter: DependencyInjectionAdapter) {
  const doubles = Promise.resolve({
    mock: jest.fn((implementation: unknown) => implementation ?? {}),
    stub: jest.fn,
  });
  return new SociableTestBedBuilder(
    doubles,
    new UnitMocker(
      doubles.then((value) => value.mock),
      Promise.resolve(currentAdapter)
    ),
    target,
    console
  );
}

function builder(target: Type<Service> = Service) {
  return createBuilder(target, adapter);
}

beforeEach(() => {
  Reflect.defineProperty(global, dependencyVerificationKey, {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  Reflect.deleteProperty(global, dependencyVerificationKey);
});

describe('opt-in composition', () => {
  it('preserves implicit mocking when composition is not selected', () => {
    const instance = resolver().instantiateClass(Service) as Service;
    expect(instance.repository).not.toBeInstanceOf(Repository);
  });

  it('constructs transitive and leaf classes when selected', () => {
    const instance = resolver(composed).instantiateClass(Service) as Service;
    expect(instance.repository).toBeInstanceOf(Repository);
    expect(instance.repository.client).toBeInstanceOf(Client);
    expect(instance.repository.client.read()).toBe('live');
  });

  it('leaves an unbound abstract-only function token unresolved', () => {
    abstract class Port {
      abstract read(): string;
    }
    class Root {
      constructor(readonly port: Port) {}
    }
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([[Root, [parameter(Port)]]]),
      jest.fn(() => ({})),
      composed
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(() => instance.port.read()).toThrow(/undeclared dependency 'Port'/);
  });

  it('does not compose an unbound abstract token with concrete members', () => {
    abstract class PartiallyImplementedPort {
      label(): string {
        return 'base';
      }

      abstract read(): string;
    }
    class Root {
      constructor(readonly port: PartiallyImplementedPort) {}
    }
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([[Root, [parameter(PartiallyImplementedPort)]]]),
      jest.fn(() => ({})),
      composed
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(() => instance.port.label()).toThrow(/undeclared dependency 'PartiallyImplementedPort'/);
  });

  it('never treats a native constructor as a composable collaborator', () => {
    class Root {
      constructor(readonly value: unknown) {}
    }
    const mock = jest.fn();
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([[Root, [parameter(Object)]]]),
      mock,
      composed
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(isGuardedDependency(instance.value)).toBe(true);
    expect(mock).not.toHaveBeenCalled();
  });

  it('resolves boundaries before inspecting their implementation graph', () => {
    const supplied = { read: jest.fn(() => 'mock') };
    const createGuard = jest.fn((path: readonly DependencyPathEntry[]) => {
      expect(path.map(({ identifier }) => identifier)).toEqual([Service, Repository, Client]);
      return supplied;
    });
    const inspect = jest.fn((type: Type) => {
      if (type === Client) {
        throw new Error('must not inspect a composition boundary');
      }
      return adapter.inspect(type);
    });
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      { inspect, canAutoConstruct: adapter.canAutoConstruct },
      jest.fn(() => ({})),
      {
        mode: 'composed',
        bindings: new Map(),
        boundaries: new CompositionBoundaryContainer([
          { kind: 'guard', identifier: Client, metadata: undefined, create: createGuard },
        ]),
      }
    );

    const instance = current.instantiateClass(Service) as Service;
    expect(instance.repository.client).toBe(supplied);
    expect(inspect).not.toHaveBeenCalledWith(Client);
    expect(createGuard).toHaveBeenCalledTimes(1);
  });

  it('retains a boundary that deliberately resolves to undefined', () => {
    const inspect = jest.fn((type: Type) => adapter.inspect(type));
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      { inspect, canAutoConstruct: adapter.canAutoConstruct },
      jest.fn(() => ({})),
      {
        mode: 'composed',
        bindings: new Map(),
        boundaries: new CompositionBoundaryContainer([
          // @ts-expect-error JavaScript can supply a boundary that returns undefined.
          { kind: 'guard', identifier: Client, metadata: undefined, create: () => undefined },
        ]),
      }
    );

    const instance = current.instantiateClass(Service) as Service;
    expect(instance.repository.client).toBeUndefined();
    expect(inspect).not.toHaveBeenCalledWith(Client);
  });

  it('prefers qualified boundaries and lets an unqualified boundary cover variants', () => {
    class Root {
      constructor(
        readonly first: Client,
        readonly second: Client
      ) {}
    }
    const defaultBoundary = { read: () => 'default' };
    const qualifiedBoundary = { read: () => 'qualified' };
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([[Root, [parameter(Client, primary), parameter(Client, secondary)]]]),
      jest.fn(() => ({})),
      {
        mode: 'composed',
        bindings: new Map(),
        boundaries: new CompositionBoundaryContainer([
          { kind: 'guard', identifier: Client, metadata: undefined, create: () => defaultBoundary },
          {
            kind: 'guard',
            identifier: Client,
            metadata: secondary,
            create: () => qualifiedBoundary,
          },
        ]),
      }
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.first).toBe(defaultBoundary);
    expect(instance.second).toBe(qualifiedBoundary);
  });

  it('preserves qualified instance identity without merging occurrences', () => {
    class Root {
      constructor(
        readonly first: Client,
        readonly second: Client,
        readonly repeated: Client
      ) {}
    }
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [
          Root,
          [parameter(Client, primary), parameter(Client, secondary), parameter(Client, primary)],
        ],
      ]),
      jest.fn(() => ({})),
      composed
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.first).not.toBe(instance.second);
    expect(instance.first).toBe(instance.repeated);
  });

  it('composes property dependencies and shares their graph identity', () => {
    class Root {
      first!: Repository;
      second!: Repository;
    }
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [
          Root,
          [
            {
              identifier: Repository,
              value: Repository,
              type: 'PROPERTY',
              property: { key: 'first' },
            },
            {
              identifier: Repository,
              value: Repository,
              type: 'PROPERTY',
              property: { key: 'second' },
            },
          ],
        ],
        [Repository, [parameter(Client)]],
        [Client, []],
      ]),
      jest.fn(() => ({})),
      composed
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.first).toBeInstanceOf(Repository);
    expect(instance.second).toBe(instance.first);
    expect(instance.first.client).toBeInstanceOf(Client);
  });

  it('constructs the same registered adapter token in selective and composed modes', async () => {
    const token = new TestToken<Repository>('repository');
    class BoundRoot {
      constructor(
        readonly repository: Repository,
        readonly repeated: Repository
      ) {}
    }
    const currentAdapter = registry([
      [BoundRoot, [parameter(token), parameter(token)]],
      [Repository, [parameter(Client)]],
      [Client, []],
    ]);
    const fresh = () => createBuilder(BoundRoot, currentAdapter);

    const selective = fresh().expose(Client);
    const composed = fresh().compose();
    const exposed = await selective.bind(token, Repository).compile();
    const recursive = await composed.bind(token, Repository).compile();
    for (const result of [exposed, recursive]) {
      expect(result.unit.repository).toBeInstanceOf(Repository);
      expect(result.unit.repository).toBe(result.unit.repeated);
      expect(result.unit.repository.client).toBeInstanceOf(Client);
      expect(() => result.unitRef.get(token)).toThrow('exposed dependency');
    }
  });

  it('keeps requested token identities distinct when implementations match', async () => {
    const first = Symbol('repository');
    const second = Symbol('repository');
    class BoundRoot {
      constructor(
        readonly first: Repository,
        readonly repeated: Repository,
        readonly second: Repository
      ) {}
    }
    const currentAdapter = registry([
      [BoundRoot, [parameter(first), parameter(first), parameter(second)]],
      [Repository, [parameter(Client)]],
      [Client, []],
    ]);

    const { unit } = await createBuilder(BoundRoot, currentAdapter)
      .compose()
      .bind(first, Repository)
      .bind(second, Repository)
      .compile();

    expect(unit.first).toBe(unit.repeated);
    expect(unit.first).not.toBe(unit.second);
  });

  it('rejects token-wide overrides and bindings before constructing any collaborator', async () => {
    const token = Symbol('repository');
    const constructed = jest.fn();
    const configureMock = jest.fn(() => ({}));
    class BoundRepository {
      constructor() {
        constructed();
      }
    }
    class BoundRoot {
      constructor(readonly repository: BoundRepository) {
        constructed();
      }
    }
    const currentAdapter = registry([
      [BoundRoot, [parameter(token)]],
      [BoundRepository, []],
    ]);
    const selector = createBuilder(BoundRoot, currentAdapter);
    for (const mode of [selector.expose(BoundRepository), selector.compose()]) {
      const bound = mode.bind(token, BoundRepository);
      const declarations = [
        bound.mock(token).impl(configureMock),
        bound.mock(token).final({}),
        mode.mock(token).impl(configureMock).bind(token, BoundRepository),
        mode.mock(token).final({}).bind(token, BoundRepository),
      ];
      for (const declaration of declarations) {
        await expect(declaration.compile()).rejects.toThrow(/conflicting.*repository/i);
      }
    }
    expect(constructed).not.toHaveBeenCalled();
    expect(configureMock).not.toHaveBeenCalled();
  });

  it('rejects contradictory bindings in both construction modes', async () => {
    const token = Symbol('repository');
    class AlternativeRepository extends Repository {}
    class BoundRoot {
      constructor(readonly repository: Repository) {}
    }
    const currentAdapter = registry([
      [BoundRoot, [parameter(token)]],
      [Repository, [parameter(Client)]],
      [AlternativeRepository, [parameter(Client)]],
      [Client, []],
    ]);
    const fresh = () => createBuilder(BoundRoot, currentAdapter);

    await expect(
      fresh().expose(Client).bind(token, Repository).bind(token, AlternativeRepository).compile()
    ).rejects.toThrow(/Conflicting bindings.*repository/);
    await expect(
      fresh().compose().bind(token, Repository).bind(token, AlternativeRepository).compile()
    ).rejects.toThrow(/Conflicting bindings.*repository/);
    const base = fresh().expose(Client).bind(token, Repository);
    const conflicting = base.bind(token, AlternativeRepository);
    await expect(conflicting.compile()).rejects.toThrow(/Conflicting bindings.*repository/);
    await expect(base.bind(token, Repository).compile()).resolves.toBeDefined();
  });

  it('rejects a binding without a runtime implementation', () => {
    const current = builder().compose();
    expect(() => Reflect.apply(current.bind, current, ['repository', undefined])).toThrow(
      'requires a concrete implementation'
    );
  });

  it('reports constructor cycles with their dependency path', () => {
    class One {}
    class Two {}
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [One, [parameter(Two)]],
        [Two, [parameter(One)]],
      ]),
      jest.fn(() => ({})),
      composed
    );

    expect(() => current.instantiateClass(One)).toThrow('One -> Two -> One');
  });

  it('keeps independently configured branches of one composed builder isolated', async () => {
    const composed = builder().compose();
    const one = composed.mock(Client).final({ read: () => 'one' });
    const two = composed.mock(Client).impl(() => ({ read: () => 'two' }));

    const [original, first, second] = await Promise.all([
      composed.compile(),
      one.compile(),
      two.compile(),
    ]);
    expect(original.unit.repository.client.read()).toBe('live');
    expect(first.unit.repository.client.read()).toBe('one');
    expect(second.unit.repository.client.read()).toBe('two');
  });

  it('resolves an implemented mock before a final for the same identifier in either mode', async () => {
    for (const selected of [builder().expose(Repository), builder().compose()]) {
      const { unit } = await selected
        .mock(Client)
        .final({ read: () => 'final' })
        .mock(Client)
        .impl(() => ({ read: () => 'implemented' }))
        .compile();

      expect(unit.repository.client.read()).toBe('implemented');
    }
  });

  it('retains composed mode through both override forms', async () => {
    const implemented = await builder()
      .compose()
      .mock(Client)
      .impl(() => ({ read: () => 'implemented' }))
      .compile();
    const finalized = await builder()
      .compose()
      .mock(Client)
      .final({ read: () => 'final' })
      .compile();

    expect(implemented.unit.repository).toBeInstanceOf(Repository);
    expect(implemented.unit.repository.client.read()).toBe('implemented');
    expect(finalized.unit.repository).toBeInstanceOf(Repository);
    expect(finalized.unit.repository.client.read()).toBe('final');
  });

  it('offers only mode selection on the initial builder', () => {
    const selector = builder();
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(selector)).sort()).toEqual([
      'compose',
      'constructor',
      'expose',
    ]);
    expect('compile' in selector).toBe(false);
    expect('mock' in selector).toBe(false);
    expect('bind' in selector).toBe(false);
    expect('forbid' in selector).toBe(false);
  });

  it('keeps variadic selective exposure mutually exclusive with composition', async () => {
    class EmptyLeaf {}
    class AnotherEmptyLeaf {}
    class Root {
      constructor(
        readonly leaf: EmptyLeaf,
        readonly anotherLeaf: AnotherEmptyLeaf
      ) {}
    }
    const currentAdapter = registry([[Root, [parameter(EmptyLeaf), parameter(AnotherEmptyLeaf)]]]);
    const doubles = Promise.resolve({
      mock: jest.fn((implementation: unknown) => implementation ?? {}),
      stub: jest.fn,
    });
    const createBuilder = () =>
      new SociableTestBedBuilder(
        doubles,
        new UnitMocker(
          doubles.then((value) => value.mock),
          Promise.resolve(currentAdapter)
        ),
        Root,
        console
      );

    const selective = createBuilder().expose(EmptyLeaf, AnotherEmptyLeaf);
    const composed = createBuilder().compose();
    const exposed = await selective.compile();

    expect('compose' in selective).toBe(false);
    expect('expose' in composed).toBe(false);
    expect(exposed.unit.leaf).toBeInstanceOf(EmptyLeaf);
    expect(exposed.unit.anotherLeaf).toBeInstanceOf(AnotherEmptyLeaf);
  });

  it('requires selective mode to expose at least one dependency', () => {
    expect(() => {
      // @ts-expect-error Selective exposure cannot be selected without a dependency.
      builder().expose();
    }).toThrow('Selective exposure requires at least one dependency');
  });

  it('rejects retrieving recursively composed real dependencies', async () => {
    const { unitRef } = await builder().compose().compile();
    expect(() => unitRef.get(Repository)).toThrow('exposed dependency');
    expect(() => unitRef.get(Client)).toThrow('exposed dependency');
  });
});
