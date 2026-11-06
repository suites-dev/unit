import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { Injectable } from '@nestjs/common';
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
    const { unit, unitRef } = await TestBed.sociable(Service).compose().exclude([Host]).compile();
    const host = unitRef.get(Host);
    host.region.mockReturnValue('singapore');
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('cache:singapore');
    expect(() => unitRef.get(Repository)).toThrow();
    expect(() => unitRef.get(Leaf)).toThrow();
    const invalid = () => {
      // @ts-expect-error Mock inference remains specific after composition.
      host.region.mockReturnValue(42);
      // @ts-expect-error Boundaries require at least one identifier.
      TestBed.sociable(Service).compose().exclude([]);
      // @ts-expect-error Exclusions are available only in composition mode.
      TestBed.sociable(Service).exclude([Host]);
      // @ts-expect-error Selective exposure stays concrete-only.
      TestBed.sociable(Service).expose(Host);
      // @ts-expect-error Composition and selective exposure are separate strategies.
      TestBed.sociable(Service).compose().expose(Repository);
    };
    expect(invalid).toBeDefined();
  });

  it('preserves mode methods through typed implementation and final overrides', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service)
      .compose()
      .mock(Host)
      .impl((stub) => ({ region: stub().mockReturnValue('tokyo') }))
      .exclude([Host])
      .mock(Leaf)
      .final({ prefix: () => 'fake:' })
      .exclude([Host])
      .compile();
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
