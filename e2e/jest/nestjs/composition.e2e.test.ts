import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';

@Injectable()
class Leaf {
  prefix(): string {
    return 'live:';
  }
}

@Injectable()
class Repository {
  constructor(readonly leaf: Leaf) {}
  read(): string {
    return this.leaf.prefix() + 'value';
  }
}

@Injectable()
class Service {
  constructor(readonly repository: Repository) {}
  read(): string {
    return this.repository.read();
  }
}

describe('V5 opt-in composition', () => {
  it('constructs the discovered class graph recursively', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service).compose().compile();
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('live:value');
    expect(() => unitRef.get(Repository)).toThrow(/exposed dependency/);
    expect(() => unitRef.get(Leaf)).toThrow(/exposed dependency/);
    const invalid = () => {
      // @ts-expect-error Composition preserves the subject type.
      unit.missingMethod();
      // @ts-expect-error Composition belongs to sociable builders only.
      TestBed.solitary(Service).compose();
    };
    expect(invalid).toBeDefined();
  });

  it('retains exposure and explicit override chains in composed mode', async () => {
    const before = await TestBed.sociable(Service).expose(Repository).compose().compile();
    const after = await TestBed.sociable(Service).compose().expose(Repository).compile();
    const overridden = await TestBed.sociable(Service)
      .compose()
      .mock(Leaf)
      .impl((stub) => ({ prefix: stub().mockReturnValue('mock:') }))
      .expose(Repository)
      .compile();
    expect(before.unit.read()).toBe('live:value');
    expect(after.unit.read()).toBe('live:value');
    expect(overridden.unit.repository).toBeInstanceOf(Repository);
    expect(overridden.unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(overridden.unit.read()).toBe('mock:value');
    expect(overridden.unitRef.get(Leaf).prefix).toHaveBeenCalledTimes(1);
  });
});
