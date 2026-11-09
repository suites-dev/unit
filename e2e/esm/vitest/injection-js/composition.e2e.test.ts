import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Injectable } from 'injection-js';
import { TestBed } from '@suites/unit';

abstract class Host {
  abstract region(): string;
}
@Injectable()
class Leaf {
  prefix() {
    return 'cache:';
  }
}
@Injectable()
class Repository {
  constructor(
    readonly host: Host,
    readonly leaf: Leaf
  ) {}
  read() {
    return this.leaf.prefix() + this.host.region();
  }
}
@Injectable()
class Service {
  constructor(readonly repository: Repository) {}
  read() {
    return this.repository.read();
  }
}

describe('opt-in composition', () => {
  it('constructs the transitive graph and mocks excluded abstract tokens', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service).compose().exclude(Host).compile();
    const host = unitRef.get(Host);
    host.region.mockReturnValue('singapore');
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('cache:singapore');
    expect(() => unitRef.get(Repository)).toThrow();
    expect(() => unitRef.get(Leaf)).toThrow();
    const invalid = () => {
      // @ts-expect-error Composition preserves the subject type.
      unit.nonexistentMethod();
      // @ts-expect-error Mock inference remains specific after composition.
      host.region.mockReturnValue(42);
      // @ts-expect-error Boundaries require at least one identifier.
      TestBed.sociable(Service).compose().exclude();
      // @ts-expect-error Pass tokens as separate arguments or spread a tuple.
      TestBed.sociable(Service).compose().exclude([Host, Leaf]);
      // @ts-expect-error Exclusions are available only in composition mode.
      TestBed.sociable(Service).exclude(Host);
      // @ts-expect-error Selective exposure stays concrete-only.
      TestBed.sociable(Service).expose(Host);
      // @ts-expect-error Composition and selective exposure are separate strategies.
      TestBed.sociable(Service).compose().expose(Repository);
    };
    expect(invalid).toBeDefined();
  });

  it('mocks every variadic boundary and accepts readonly tuples', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service)
      .compose()
      .exclude(Host, Leaf)
      .compile();
    unitRef.get(Host).region.mockReturnValue('singapore');
    unitRef.get(Leaf).prefix.mockReturnValue('mock:');
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('mock:singapore');

    const boundaries = [Host, Leaf] as const;
    const { unit: spread, unitRef: spreadRef } = await TestBed.sociable(Service)
      .compose()
      .exclude(...boundaries)
      .compile();
    spreadRef.get(Host).region.mockReturnValue('tokyo');
    spreadRef.get(Leaf).prefix.mockReturnValue('spread:');
    expect(spread.read()).toBe('spread:tokyo');
  });

  it('accumulates distinct boundaries across consecutive exclusions', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service)
      .compose()
      .exclude(Host)
      .exclude(Leaf)
      .compile();
    const host = unitRef.get(Host);
    const leaf = unitRef.get(Leaf);
    host.region.mockReturnValue('tokyo');
    leaf.prefix.mockReturnValue('mock:');
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.host).toBe(host);
    expect(unit.repository.leaf).toBe(leaf);
    expect(unit.read()).toBe('mock:tokyo');
    expect(host.region).toHaveBeenCalledTimes(1);
    expect(leaf.prefix).toHaveBeenCalledTimes(1);
  });

  it('uses explicit automatic mocks as composition boundaries', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service)
      .compose()
      .mock(Leaf)
      .auto()
      .exclude(Host)
      .compile();
    const leaf = unitRef.get(Leaf);
    expect(leaf.prefix()).toBeUndefined();
    leaf.prefix.mockReturnValue('auto:');
    unitRef.get(Host).region.mockReturnValue('tokyo');
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('auto:tokyo');
    const invalid = () => {
      // @ts-expect-error Automatic mock completion preserves the subject type.
      unit.nonexistentMethod();
      // @ts-expect-error Automatic mocks preserve method return types.
      leaf.prefix.mockReturnValue(42);
      // @ts-expect-error A mock selector requires auto, impl, or final.
      TestBed.solitary(Service).mock(Repository).compile();
    };
    expect(invalid).toBeDefined();
  });

  it('preserves selective and solitary chains after automatic mock declarations', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service)
      .expose(Leaf)
      .mock(Host)
      .auto()
      .expose(Repository)
      .compile();
    unitRef.get(Host).region.mockReturnValue('singapore');
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('cache:singapore');

    const { unit: isolated, unitRef: isolatedRef } = await TestBed.solitary(Service)
      .mock(Repository)
      .auto()
      .compile();
    isolatedRef.get(Repository).read.mockReturnValue('isolated');
    expect(isolated.read()).toBe('isolated');
  });

  it('preserves the subject type through implementation overrides', async () => {
    const { unit } = await TestBed.sociable(Service)
      .compose()
      .mock(Host)
      .impl((stub) => ({ region: stub().mockReturnValue('tokyo') }))
      .compile();
    expect(unit.read()).toBe('cache:tokyo');
    const invalid = () => {
      // @ts-expect-error Implementation overrides preserve the subject type.
      unit.nonexistentMethod();
    };
    expect(invalid).toBeDefined();
  });

  it('preserves mode methods through typed implementation and final overrides', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service)
      .compose()
      .mock(Host)
      .impl((stub) => ({ region: stub().mockReturnValue('tokyo') }))
      .exclude(Host)
      .mock(Leaf)
      .final({ prefix: () => 'fake:' })
      .exclude(Host)
      .compile();
    const invalid = () => {
      // @ts-expect-error Final overrides preserve the subject type.
      unit.nonexistentMethod();
    };
    expect(invalid).toBeDefined();
    expect(unit.read()).toBe('fake:tokyo');
    expect(unitRef.get(Host).region).toHaveBeenCalledTimes(1);
    expect(() => unitRef.get(Leaf)).toThrow();
  });

  it('preserves existing V4 selective mock chains and implicit mocking', async () => {
    const { unit } = await TestBed.sociable(Service)
      .expose(Repository)
      .mock(Repository)
      .final({ read: () => 'legacy' })
      .compile();
    expect(unit.read()).toBe('legacy');
    const { unit: partial } = await TestBed.sociable(Service).expose(Repository).compile();
    expect(partial.repository).toBeInstanceOf(Repository);
    expect(partial.repository.leaf).not.toBeInstanceOf(Leaf);
  });
});
