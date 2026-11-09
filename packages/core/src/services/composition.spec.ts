import type { Type } from '@suites/types.common';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  InjectableIdentifier,
} from '@suites/types.di';
import { DependencyContainer } from './dependency-container.js';
import { DependencyResolver } from './dependency-resolver.js';
import { SociableTestBedBuilder } from './builders/sociable-unit-builder.js';
import { UnitMocker } from './unit-mocker.js';

function registry(entries: [Type, ClassInjectable[]][]): DependencyInjectionAdapter {
  return {
    inspect: (type: Type) => ({
      list: () => entries.find(([target]) => type === target)?.[1] ?? [],
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
}
const param = (identifier: InjectableIdentifier, metadata?: unknown): ClassInjectable =>
  ({ identifier, metadata, type: 'PARAM' }) as ClassInjectable;
const primary = { named: 'primary' } as never;
const secondary = { named: 'secondary' } as never;

class Client {
  read() {
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
  [Service, [param(Repository)]],
  [Repository, [param(Client)]],
]);
function resolver(
  options = {},
  overrides: ConstructorParameters<typeof DependencyContainer>[0] = []
) {
  return new DependencyResolver(
    [],
    new DependencyContainer(overrides),
    adapter,
    jest.fn(() => ({})),
    options
  );
}
function builder() {
  const doubles = Promise.resolve({
    mock: jest.fn((implementation: unknown) => implementation ?? {}),
    stub: jest.fn,
  });
  return new SociableTestBedBuilder(
    doubles,
    new UnitMocker(
      doubles.then((x) => x.mock),
      Promise.resolve(adapter)
    ),
    Service,
    console
  );
}

describe('opt-in composition', () => {
  it('preserves implicit mocking when composition is not selected', () => {
    const instance = resolver().instantiateClass(Service) as unknown as Service;
    expect(instance.repository).not.toBeInstanceOf(Repository);
  });

  it('constructs transitive and leaf classes when explicitly selected', () => {
    const instance = resolver({ compose: true }).instantiateClass(Service) as unknown as Service;
    expect(instance.repository).toBeInstanceOf(Repository);
    expect(instance.repository.client).toBeInstanceOf(Client);
    expect(instance.repository.client.read()).toBe('live');
  });

  it('never inspects or constructs an excluded boundary', () => {
    const inspect = jest.fn((type: Type) => {
      if (type === Client) throw new Error('must not discover the excluded client');
      return adapter.inspect(type);
    });
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      { inspect },
      jest.fn(() => ({})),
      { compose: true, excludedIdentifiers: [Client] }
    );
    const instance = current.instantiateClass(Service) as unknown as Service;
    expect(instance.repository.client).not.toBeInstanceOf(Client);
    expect(inspect).not.toHaveBeenCalledWith(Client);
  });

  it('reuses shared instances without merging metadata-qualified occurrences', () => {
    class Root {
      constructor(
        readonly one: Client,
        readonly two: Client,
        readonly three: Client
      ) {}
    }
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [Root, [param(Client, primary), param(Client, secondary), param(Client, primary)]],
      ]),
      jest.fn(() => ({})),
      { compose: true }
    );
    const instance = current.instantiateClass(Root) as unknown as Root;
    expect(instance.one).not.toBe(instance.two);
    expect(instance.one).toBe(instance.three);
  });

  it('gives specific overrides precedence over identity-wide exclusions', () => {
    const override = { read: () => 'fake' };
    const current = resolver({ compose: true, excludedIdentifiers: [Client] }, [
      [{ identifier: Client, metadata: primary }, override],
    ]);
    expect(current.resolveOrMock(Client, primary)).toBe(override);
    expect(current.resolveOrMock(Client, secondary)).not.toBe(override);
  });

  it('guards only the metadata-qualified real instance, not an overridden sibling', async () => {
    class Root {
      constructor(
        readonly first: Client,
        readonly second: Client
      ) {}
    }
    const localAdapter = registry([[Root, [param(Client, primary), param(Client, secondary)]]]);
    const doubles = Promise.resolve({ mock: jest.fn((value) => value ?? {}), stub: jest.fn });
    const rootBuilder = new SociableTestBedBuilder(
      doubles,
      new UnitMocker(
        doubles.then((x) => x.mock),
        Promise.resolve(localAdapter)
      ),
      Root,
      console
    );
    const { unit, unitRef } = await rootBuilder
      .compose()
      .mock(Client, secondary)
      .impl(() => ({ read: () => 'fake' }))
      .compile();
    expect(unit.first).toBeInstanceOf(Client);
    expect(unit.second).not.toBeInstanceOf(Client);
    expect(unitRef.get(Client, secondary)).toBe(unit.second);
    expect(() => unitRef.get(Client, primary)).toThrow('exposed dependency');
  });

  it('composes property dependencies and preserves shared graph identity', () => {
    class Root {
      first!: Repository;
      second!: Repository;
    }
    const localAdapter = registry([
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
      [Repository, [param(Client)]],
    ]);
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      localAdapter,
      jest.fn(() => ({})),
      { compose: true }
    );
    const instance = current.instantiateClass(Root) as unknown as Root;
    expect(instance.first).toBeInstanceOf(Repository);
    expect(instance.second).toBe(instance.first);
    expect(instance.first.client).toBeInstanceOf(Client);
  });

  it('retains distinct object-token identities', () => {
    const first = { description: 'same' } as unknown as InjectableIdentifier;
    const second = { description: 'same' } as unknown as InjectableIdentifier;
    const one = { marker: 1 };
    const current = resolver({ compose: true, excludedIdentifiers: [first] }, [
      [{ identifier: second }, one],
    ]);
    expect(current.resolveOrMock(first)).not.toBe(one);
    expect(current.resolveOrMock(second)).toBe(one);
  });

  it('reports constructor cycles with a dependency path before overflowing', () => {
    class One {}
    class Two {}
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [One, [param(Two)]],
        [Two, [param(One)]],
      ]),
      jest.fn(() => ({})),
      { compose: true }
    );
    expect(() => current.instantiateClass(One)).toThrow('One -> Two -> One');
  });

  it('allows a mock boundary to cut a constructor cycle', () => {
    class One {
      constructor(readonly two: unknown) {}
    }
    class Two {}
    const current = new DependencyResolver(
      [],
      new DependencyContainer([]),
      registry([
        [One, [param(Two)]],
        [Two, [param(One)]],
      ]),
      jest.fn(() => ({})),
      { compose: true, excludedIdentifiers: [Two] }
    );
    expect(() => current.instantiateClass(One)).not.toThrow();
  });

  it('retains the composed mode through both override forms', async () => {
    const { unit } = await builder()
      .compose()
      .mock(Client)
      .final({ read: () => 'fake' })
      .exclude(Client)
      .compile();
    expect(unit.repository.client.read()).toBe('fake');
    const { unit: mocked } = await builder()
      .compose()
      .mock(Client)
      .impl(() => ({ read: () => 'mocked' }))
      .exclude(Client)
      .compile();
    expect(mocked.repository).toBeInstanceOf(Repository);
  });

  it('creates independent composed builders without changing the original mode', async () => {
    const current = builder();
    const composed = current.compose();
    const sibling = current.compose();
    expect(composed).not.toBe(current);
    expect(composed).not.toBe(sibling);
    expect('expose' in composed).toBe(false);
    expect('exclude' in current).toBe(false);
    composed.exclude(Repository);
    current.expose(Repository);

    const { unit: selected } = await current.compile();
    const { unit: automatic } = await sibling.compile();
    const { unit: excluded } = await composed.compile();
    expect(selected.repository).toBeInstanceOf(Repository);
    expect(selected.repository.client).not.toBeInstanceOf(Client);
    expect(automatic.repository.client).toBeInstanceOf(Client);
    expect(excluded.repository).not.toBeInstanceOf(Repository);
  });

  it('copies existing mock configuration without sharing later declarations', async () => {
    const current = builder();
    current.mock(Client).impl(() => ({ read: () => 'configured' }));
    const composed = current.compose();
    current.mock(Repository).final({ client: { read: () => 'original-only' } });
    const { unit } = await composed.compile();
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.client.read()).toBe('configured');
  });

  it('copies final values into composition', async () => {
    const current = builder();
    const supplied = { read: () => 'supplied' };
    current.mock(Client).final(supplied);
    const { unit } = await current.compose().compile();
    expect(unit.repository.client).toBe(supplied);
  });

  it('rejects new mode conflicts and empty exclusions', () => {
    expect(() => builder().expose(Repository).compose()).toThrow('Cannot combine');
    expect(() => {
      // @ts-expect-error Exercise the runtime guard for JavaScript callers.
      builder().compose().exclude();
    }).toThrow('at least one');
  });

  it('rejects retrieving a composed real value while allowing mocks', async () => {
    const { unitRef } = await builder().compose().exclude(Client).compile();
    expect(() => unitRef.get(Repository)).toThrow('exposed dependency');
    expect(unitRef.get(Client)).toEqual({});
  });
});
