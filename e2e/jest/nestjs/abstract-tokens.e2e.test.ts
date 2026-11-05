import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/unit';
import type { AbstractType, Type } from '@suites/types.common';

abstract class Host {
  abstract region(): string;
}

class MockHost extends Host {
  constructor(private readonly value: string) {
    super();
  }
  region(): string {
    return this.value;
  }
}

@Injectable()
class Repository {
  constructor(readonly host: Host) {}
  readRegion(): string {
    return this.host.region();
  }
}

@Injectable()
class Service {
  constructor(readonly repository: Repository) {}
  readRegion(): string {
    return this.repository.readRegion();
  }
}

describe('abstract class dependency tokens', () => {
  it('infers the mock type from an abstract token', async () => {
    const { unit, unitRef } = await TestBed.solitary(Repository).compile();
    const host = unitRef.get(Host);
    const typed: Mocked<Host> = host;
    typed.region.mockReturnValue('singapore');
    expect(unit.readRegion()).toBe('singapore');
    expect(host.region).toHaveBeenCalledTimes(1);

    // Checked by tsc, never executed: inference must not fall back to any.
    const checkTypes = () => {
      // @ts-expect-error Host.region returns a string.
      host.region.mockReturnValue(42);
      // @ts-expect-error Host has no unknownMethod member.
      host.unknownMethod();
    };
    expect(checkTypes).toBeDefined();
  });

  it('accepts a concrete implementation for an abstract token', async () => {
    const supplied = new MockHost('singapore');
    const { unit, unitRef } = await TestBed.solitary(Repository)
      .mock(Host)
      .final(supplied)
      .compile();
    expect(unit.host).toBe(supplied);
    expect(unit.readRegion()).toBe('singapore');
    expect(() => unitRef.get(Host)).toThrow(/faked dependency/);
  });

  it('infers the abstract dependency when configuring an implementation', async () => {
    const { unit, unitRef } = await TestBed.solitary(Repository)
      .mock(Host)
      .impl((stub) => ({ region: stub().mockReturnValue('singapore') }))
      .compile();
    const host = unitRef.get(Host);
    expect(unit.readRegion()).toBe('singapore');
    host.region.mockReturnValue('london');
    expect(unit.readRegion()).toBe('london');
  });

  it('keeps an abstract dependency mocked when exposing its concrete consumer', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service).expose(Repository).compile();
    unitRef.get(Host).region.mockReturnValue('singapore');
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.readRegion()).toBe('singapore');
  });

  it('requires concrete constructors only where classes are instantiated', () => {
    const concrete: Type<MockHost> = MockHost;
    const token: AbstractType<Host> = Host;
    const concreteToken: AbstractType<Host> = MockHost;
    expect(new concrete('singapore').region()).toBe('singapore');
    expect(token).toBe(Host);
    expect(concreteToken).toBe(MockHost);

    const checkTypes = () => {
      // @ts-expect-error An abstract token is not a constructible Type.
      const invalid: Type<Host> = Host;
      void invalid;
      // @ts-expect-error The class under test must be concrete.
      TestBed.solitary(Host);
      // @ts-expect-error The class under test must be concrete.
      TestBed.sociable(Host);
      // @ts-expect-error Exposed classes must be concrete.
      TestBed.sociable(Service).expose(Host);
      const override = TestBed.solitary(Repository).mock(Host);
      // @ts-expect-error Final overrides infer Host and reject unrelated properties.
      override.final({ unknownMethod: () => 42 });
      // @ts-expect-error Implementation callbacks infer Host and reject unrelated properties.
      override.impl(() => ({ unknownMethod: () => 42 }));
    };
    expect(checkTypes).toBeDefined();
  });
});
