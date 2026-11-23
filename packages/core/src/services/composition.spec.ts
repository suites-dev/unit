import type { Type } from '@suites/types.common';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  InjectableIdentifier,
} from '@suites/types.di';
import type { DependencyPathEntry } from './composition-boundary.js';
import { CompositionBoundaryContainer } from './composition-boundary.js';
import { DependencyContainer } from './dependency-container.js';
import { DependencyResolver } from './dependency-resolver.js';
import { SociableTestBedBuilder } from './builders/sociable-unit-builder.js';
import { UnitMocker } from './unit-mocker.js';

function registry(entries: [Type, ClassInjectable[]][]): DependencyInjectionAdapter {
  return {
    isConstructable: (type: Type) => entries.some(([target]) => type === target),
    inspect: (type: Type) => ({
      list: () => entries.find(([target]) => type === target)?.[1] ?? [],
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
}

const parameter = (identifier: InjectableIdentifier, metadata?: unknown): ClassInjectable =>
  ({ identifier, metadata, type: 'PARAM' }) as ClassInjectable;
const primary = { named: 'primary' } as never;
const secondary = { named: 'secondary' } as never;

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

function resolver(options = {}) {
  return new DependencyResolver(
    [],
    new DependencyContainer([]),
    adapter,
    jest.fn(() => ({})),
    options
  );
}

function builder(target: Type<Service> = Service) {
  const doubles = Promise.resolve({
    mock: jest.fn((implementation: unknown) => implementation ?? {}),
    stub: jest.fn,
  });
  return new SociableTestBedBuilder(
    doubles,
    new UnitMocker(
      doubles.then((value) => value.mock),
      Promise.resolve(adapter)
    ),
    target,
    console
  );
}

describe('opt-in composition', () => {
  it('preserves implicit mocking when composition is not selected', () => {
    const instance = resolver().instantiateClass(Service) as Service;
    expect(instance.repository).not.toBeInstanceOf(Repository);
  });

  it('constructs transitive and leaf classes when selected', () => {
    const instance = resolver({ compose: true }).instantiateClass(Service) as Service;
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
      { compose: true }
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.port).not.toBeInstanceOf(Port);
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
      { compose: true }
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.port).not.toBeInstanceOf(PartiallyImplementedPort);
  });

  it('never treats a native constructor as a composable collaborator', () => {
    class Root {
      constructor(readonly value: unknown) {}
    }
    const mock = { marker: 'mock' };
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([[Root, [parameter(Object)]]]),
      jest.fn(() => mock),
      { compose: true }
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.value).toBe(mock);
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
      { inspect, isConstructable: adapter.isConstructable },
      jest.fn(() => ({})),
      {
        compose: true,
        boundaries: new CompositionBoundaryContainer([
          { kind: 'guard', identifier: Client, create: createGuard },
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
      { inspect, isConstructable: adapter.isConstructable },
      jest.fn(() => ({})),
      {
        compose: true,
        boundaries: new CompositionBoundaryContainer([
          { kind: 'guard', identifier: Client, create: () => undefined },
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
        compose: true,
        boundaries: new CompositionBoundaryContainer([
          { kind: 'guard', identifier: Client, create: () => defaultBoundary },
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
      { compose: true }
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
              type: 'PROPERTY',
              property: { key: 'first' },
            } as ClassInjectable,
            {
              identifier: Repository,
              type: 'PROPERTY',
              property: { key: 'second' },
            } as ClassInjectable,
          ],
        ],
        [Repository, [parameter(Client)]],
        [Client, []],
      ]),
      jest.fn(() => ({})),
      { compose: true }
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.first).toBeInstanceOf(Repository);
    expect(instance.second).toBe(instance.first);
    expect(instance.first.client).toBeInstanceOf(Client);
  });

  it('follows a supplied token binding through its dependency graph', () => {
    const repositoryToken = Symbol('repository');
    class Root {
      constructor(readonly repository: Repository) {}
    }
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [Root, [parameter(repositoryToken)]],
        [Repository, [parameter(Client)]],
        [Client, []],
      ]),
      jest.fn(() => ({})),
      {
        compose: true,
        exposedBindings: new Map([[repositoryToken, Repository]]),
      }
    );

    const instance = current.instantiateClass(Root) as Root;
    expect(instance.repository).toBeInstanceOf(Repository);
    expect(instance.repository.client).toBeInstanceOf(Client);
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
      { compose: true }
    );

    expect(() => current.instantiateClass(One)).toThrow('One -> Two -> One');
  });

  it('keeps original and sibling builders independent', async () => {
    const original = builder();
    const composed = original.compose();
    const sibling = original.compose();
    const selective = original.expose(Repository);
    composed.mock(Repository).final({ client: { read: () => 'supplied' } });

    const unchanged = await original.compile();
    const selected = await selective.compile();
    const recursive = await sibling.compile();
    const overridden = await composed.compile();

    expect(unchanged.unit.repository).not.toBeInstanceOf(Repository);
    expect(selected.unit.repository).toBeInstanceOf(Repository);
    expect(selected.unit.repository.client).not.toBeInstanceOf(Client);
    expect(recursive.unit.repository.client).toBeInstanceOf(Client);
    expect(overridden.unit.repository).not.toBeInstanceOf(Repository);
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

  it('rejects retrieving recursively composed real dependencies', async () => {
    const { unitRef } = await builder().compose().compile();
    expect(() => unitRef.get(Repository)).toThrow('exposed dependency');
    expect(() => unitRef.get(Client)).toThrow('exposed dependency');
  });
});
