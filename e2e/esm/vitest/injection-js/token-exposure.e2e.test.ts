import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Injectable as injectable, Inject as inject } from 'injection-js';
import { TestBed } from '@suites/unit';

const PRIMARY = Symbol('provider');
const SECONDARY = 'provider';
abstract class Port {
  abstract region(): string;
}
@injectable()
class Cache {
  read(): string {
    return 'real';
  }
}
@injectable()
class Provider extends Port {
  constructor(@inject(Cache) readonly cache: Cache) {
    super();
  }
  region(): string {
    return this.cache.read();
  }
}
@injectable()
class Root {
  constructor(
    @inject(PRIMARY) readonly primary: Port,
    @inject(PRIMARY) readonly repeated: Port,
    @inject(SECONDARY) readonly secondary: Port,
    @inject(Provider) readonly direct: Provider,
    @inject(Port) readonly abstract: Port
  ) {}
}
@injectable()
class Single {
  constructor(@inject(PRIMARY) readonly provider: Port) {}
}

describe('token exposure', () => {
  it('constructs string, symbol and abstract bindings without aliasing token identities', async () => {
    const { unit, unitRef } = await TestBed.sociable(Root)
      .expose(PRIMARY, Provider)
      .expose(SECONDARY, Provider)
      .expose(Provider)
      .expose(Port, Provider)
      .mock(Cache)
      .impl((stub) => ({ read: stub().mockReturnValue('configured') }))
      .compile();
    expect(unit.primary).toBeInstanceOf(Provider);
    expect(unit.primary).toBe(unit.repeated);
    expect(unit.primary).not.toBe(unit.secondary);
    expect(unit.primary).not.toBe(unit.direct);
    expect(unit.primary).not.toBe(unit.abstract);
    expect(unit.secondary).toBeInstanceOf(Provider);
    expect(unit.abstract).toBeInstanceOf(Provider);
    expect(unit.primary.region()).toBe('configured');
    expect(unit.secondary.region()).toBe('configured');
    expect(unit.abstract.region()).toBe('configured');
    expect(unit.direct.cache).toBe(unitRef.get(Cache));
    expect(() => unitRef.get(PRIMARY)).toThrow(/exposed dependency/);
    expect(() => unitRef.get(SECONDARY)).toThrow(/exposed dependency/);
    expect(() => unitRef.get(Port)).toThrow(/exposed dependency/);
    const checkTypes = () => {
      // @ts-expect-error Exposure preserves the subject type.
      unit.nonexistentMethod();
      // @ts-expect-error Tokens require a concrete implementation.
      TestBed.sociable(Single).expose(PRIMARY);
      // @ts-expect-error Abstract classes cannot be constructed as implementations.
      TestBed.sociable(Single).expose(PRIMARY, Port);
      // @ts-expect-error Implementations must satisfy the abstract token's instance type.
      TestBed.sociable(Root).expose(Port, Cache);
      // @ts-expect-error Implementations must satisfy concrete token instance types too.
      TestBed.sociable(Root).expose(Provider, Cache);
      // @ts-expect-error Token exposure remains selective, not a composition operation.
      TestBed.sociable(Single).compose().expose(PRIMARY, Provider);
    };
    expect(checkTypes).toBeDefined();
  });

  it('keeps normal v4 auto-mocking below the exposed implementation', async () => {
    const { unit, unitRef } = await TestBed.sociable(Single).expose(PRIMARY, Provider).compile();
    expect(unit.provider).toBeInstanceOf(Provider);
    expect(unit.provider.region()).toBeUndefined();
    unitRef.get(Cache).read.mockReturnValue('configured later');
    expect(unit.provider.region()).toBe('configured later');
  });

  it('lets automatic, implementation and final overrides replace exposed tokens', async () => {
    const automatic = await TestBed.sociable(Single)
      .expose(PRIMARY, Provider)
      .mock<Port>(PRIMARY)
      .auto()
      .compile();
    automatic.unitRef.get<Port>(PRIMARY).region.mockReturnValue('automatic');
    expect(automatic.unit.provider).toBe(automatic.unitRef.get(PRIMARY));
    expect(automatic.unit.provider.region()).toBe('automatic');
    expect(automatic.unit.provider).not.toBeInstanceOf(Provider);

    const implementation = await TestBed.sociable(Single)
      .expose(Cache)
      .mock<Port>(PRIMARY)
      .impl((stub) => ({ region: stub().mockReturnValue('implementation') }))
      .expose(PRIMARY, Provider)
      .compile();
    expect(implementation.unit.provider).toBe(implementation.unitRef.get(PRIMARY));
    expect(implementation.unit.provider.region()).toBe('implementation');

    const supplied = { region: () => 'final' };
    const final = await TestBed.sociable(Single)
      .expose(PRIMARY, Provider)
      .mock<Port>(PRIMARY)
      .final(supplied)
      .compile();
    expect(final.unit.provider).toBe(supplied);
    expect(() => final.unitRef.get(PRIMARY)).toThrow(/faked dependency/);
  });

  it('resolves nested token bindings', async () => {
    const INNER = Symbol('inner');
    @injectable()
    class Nested extends Port {
      constructor(@inject(INNER) readonly cache: Cache) {
        super();
      }
      region(): string {
        return this.cache.read();
      }
    }
    const { unit } = await TestBed.sociable(Single)
      .expose(PRIMARY, Nested)
      .expose(INNER, Cache)
      .compile();
    expect(unit.provider).toBeInstanceOf(Nested);
    expect(unit.provider.region()).toBe('real');
  });
});
