import type { Type } from '@suites/types.common';
import type {
  ClassInjectable,
  DependencyInjectionAdapter,
  InjectableIdentifier,
} from '@suites/types.di';
import { FluentSociableTestBedBuilder as SociableTestBedBuilder } from './builders/sociable-unit-builder.js';
import { UnitMocker } from './unit-mocker.js';

const param = (identifier: InjectableIdentifier, metadata?: unknown): ClassInjectable =>
  ({ identifier, metadata, type: 'PARAM' }) as ClassInjectable;

function builder<T>(root: Type<T>, entries: [Type, ClassInjectable[]][]) {
  const adapter = {
    inspect: (type: Type) => ({
      list: () => entries.find(([target]) => target === type)?.[1] ?? [],
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
  const doubles = {
    mock: jest.fn((implementation: unknown) => implementation ?? {}),
    stub: jest.fn,
  };
  const warn = jest.fn();
  const testBed = new SociableTestBedBuilder(
    doubles,
    new UnitMocker(Promise.resolve(doubles.mock), adapter),
    root,
    {
      ...console,
      warn,
    }
  );
  return { testBed, warn };
}

class Cache {
  read(): string {
    return 'live';
  }
}
class Provider {
  constructor(readonly cache: Cache) {}
  read(): string {
    return this.cache.read();
  }
}

describe('real implementations behind dependency tokens', () => {
  it.each(['PROVIDER', Symbol('PROVIDER')])(
    'constructs %s and resolves its dependencies',
    async (token) => {
      class Root {
        constructor(readonly provider: Provider) {}
      }
      const { testBed, warn } = builder(Root, [
        [Root, [param(token)]],
        [Provider, [param(Cache)]],
      ]);
      const { unit, unitRef } = await testBed
        .expose(token, Provider)
        .mock(Cache)
        .impl(() => ({ read: () => 'mock' }))
        .compile();
      expect(unit.provider).toBeInstanceOf(Provider);
      expect(unit.provider.read()).toBe('mock');
      expect(unit.provider.cache).toBe(unitRef.get(Cache));
      expect(() => unitRef.get(token)).toThrow(/exposed dependency/);
      expect(() => unitRef.get(Provider)).toThrow(/could not be located/);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it('preserves repeated token identity without aliasing other tokens or the implementation class', async () => {
    const first = Symbol('provider');
    const second = Symbol('provider');
    class Leaf {}
    class Root {
      constructor(
        readonly first: Leaf,
        readonly repeated: Leaf,
        readonly second: Leaf,
        readonly direct: Leaf
      ) {}
    }
    const { testBed } = builder(Root, [
      [Root, [param(first), param(first), param(second), param(Leaf)]],
    ]);
    const { unit } = await testBed.expose(first, Leaf).expose(second, Leaf).expose(Leaf).compile();
    expect(unit.first).toBeInstanceOf(Leaf);
    expect(unit.first).toBe(unit.repeated);
    expect(unit.first).not.toBe(unit.second);
    expect(unit.first).not.toBe(unit.direct);
    expect(unit.second).not.toBe(unit.direct);
  });

  it('keeps qualified occurrences independent and honors a qualified mock override', async () => {
    const token = Symbol('provider');
    class Leaf {}
    class Root {
      constructor(
        readonly primary: Leaf,
        readonly repeated: Leaf,
        readonly secondary: Leaf
      ) {}
    }
    const entries: [Type, ClassInjectable[]][] = [
      [
        Root,
        [
          param(token, { named: 'primary' }),
          param(token, { named: 'primary' }),
          param(token, { named: 'secondary' }),
        ],
      ],
    ];
    const { unit, unitRef } = await builder(Root, entries).testBed.expose(token, Leaf).compile();
    expect(unit.primary).toBe(unit.repeated);
    expect(unit.primary).not.toBe(unit.secondary);
    expect(unit.secondary).toBeInstanceOf(Leaf);
    expect(() => unitRef.get(token, { named: 'primary' })).toThrow(/exposed dependency/);
    expect(() => unitRef.get(token, { named: 'secondary' })).toThrow(/exposed dependency/);
    expect(() => unitRef.get(token)).toThrow(/could not be located/);

    const overridden = await builder(Root, entries)
      .testBed.expose(token, Leaf)
      .mock(token, { named: 'secondary' })
      .auto()
      .compile();
    expect(overridden.unit.primary).toBeInstanceOf(Leaf);
    expect(overridden.unit.secondary).toBe(overridden.unitRef.get(token, { named: 'secondary' }));
    expect(overridden.unit.secondary).not.toBeInstanceOf(Leaf);
  });

  it('rejects unique bare-token retrieval of a qualified real binding', async () => {
    class Root {
      constructor(readonly provider: Provider) {}
    }
    const { testBed } = builder(Root, [
      [Root, [param('provider', { named: 'primary' })]],
      [Provider, [param(Cache)]],
    ]);
    const { unitRef } = await testBed.expose('provider', Provider).compile();
    expect(() => unitRef.get('provider')).toThrow(/exposed dependency/);
    expect(() => unitRef.get('provider', { named: 'missing' })).toThrow(/could not be located/);
  });

  it.each(['auto', 'impl', 'final'] as const)(
    'lets %s override a token binding before construction',
    async (mode) => {
      const constructed = jest.fn();
      class Real {
        constructor() {
          constructed();
        }
        read() {
          return 'real';
        }
      }
      class Root {
        constructor(readonly provider: Real) {}
      }
      const testBed = builder(Root, [[Root, [param('provider')]]]).testBed.expose('provider', Real);
      const selector = testBed.mock<Real>('provider');
      const supplied = { read: () => 'supplied' };
      if (mode === 'auto') selector.auto();
      if (mode === 'impl') selector.impl(() => supplied);
      if (mode === 'final') selector.final(supplied);
      const { unit, unitRef } = await testBed.compile();
      expect(constructed).not.toHaveBeenCalled();
      if (mode === 'final') {
        expect(unit.provider).toBe(supplied);
        expect(() => unitRef.get('provider')).toThrow(/faked dependency/);
      } else {
        expect(unit.provider).toBe(unitRef.get('provider'));
      }
    }
  );

  it('constructs abstract-token implementations while preserving the dependency graph', async () => {
    abstract class Port {
      abstract read(): string;
    }
    class Root {
      constructor(readonly provider: Port) {}
    }
    const { unit, unitRef } = await builder(Root, [
      [Root, [param(Port)]],
      [Provider, [param(Cache)]],
    ])
      .testBed.expose(Port, Provider)
      .expose(Cache)
      .compile();
    expect(unit.provider).toBeInstanceOf(Provider);
    expect(unit.provider.read()).toBe('live');
    expect(() => unitRef.get(Port)).toThrow(/exposed dependency/);
  });

  it('detects constructor cycles through token bindings', async () => {
    class First {
      constructor(readonly second: Second) {}
    }
    class Second {
      constructor(readonly first: First) {}
    }
    class Root {
      constructor(readonly first: First) {}
    }
    const { testBed } = builder(Root, [
      [Root, [param('first')]],
      [First, [param('second')]],
      [Second, [param('first')]],
    ]);
    await expect(testBed.expose('first', First).expose('second', Second).compile()).rejects.toThrow(
      /Root -> first -> second -> first/
    );
  });

  it('honors a qualified final boundary during construction', async () => {
    class Shared {
      constructor(readonly next: Shared) {}
    }
    class Root {
      constructor(readonly first: Shared) {}
    }
    const { testBed } = builder(Root, [
      [Root, [param('first')]],
      [Shared, [param('second', { named: 'inner' })]],
    ]);
    const supplied = {};
    const { unit } = await testBed
      .expose('first', Shared)
      .expose('second', Shared)
      .mock('second', { named: 'inner' })
      .final(supplied)
      .compile();
    expect(unit.first).toBeInstanceOf(Shared);
    expect(unit.first.next).toBe(supplied);
  });

  it('warns for unreachable bindings and rejects contradictory implementations', async () => {
    class Root {}
    const { testBed, warn } = builder(Root, []);
    await testBed.expose('missing', Provider).compile();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing'));
    expect(() => testBed.expose('missing', Cache)).toThrow(/different implementations/);
    expect(() => testBed.expose('missing', Provider)).not.toThrow();
  });

  it('keeps selective token exposure separate from composition', () => {
    class Root {}
    expect(() => builder(Root, []).testBed.expose('provider', Provider).compose()).toThrow(
      /Cannot combine/
    );
  });

  it('rejects missing implementations in untyped calls', () => {
    class Root {}
    const { testBed } = builder(Root, []);
    expect(() => Reflect.apply(testBed.expose, testBed, ['provider'])).toThrow(
      /requires a concrete implementation/
    );
    expect(() => Reflect.apply(testBed.expose, testBed, ['provider', {}])).toThrow(
      /requires a concrete implementation/
    );
  });

  it('rejects contradictory direct-class and explicit bindings in either order', () => {
    class Root {}
    class Alternative extends Cache {}
    expect(() => builder(Root, []).testBed.expose(Cache).expose(Cache, Alternative)).toThrow(
      /different implementations/
    );
    expect(() => builder(Root, []).testBed.expose(Cache, Alternative).expose(Cache)).toThrow(
      /different implementations/
    );
  });
});
