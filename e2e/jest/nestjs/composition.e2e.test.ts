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

@Injectable()
class EmptyLeaf {}

@Injectable()
class EmptyLeafRoot {
  constructor(readonly leaf: EmptyLeaf) {}
}

describe('V5 opt-in composition', () => {
  it('constructs the discovered class graph recursively', async () => {
    const { unit, unitRef } = await TestBed.sociable(Service).compose().compile();
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('live:value');
    expect(() => unitRef.get(Repository)).toThrow(/exposed dependency/);
    expect(() => unitRef.get(Leaf)).toThrow(/exposed dependency/);
    const typedSubject: Service = unit;
    // @ts-expect-error Composition preserves the subject type.
    const invalidSubject: { missingMethod(): void } = unit;
    // @ts-expect-error Composition belongs to sociable builders only.
    const invalidBuilder = TestBed.solitary(Service).compose;
    expect(typedSubject).toBe(unit);
    expect(invalidSubject).toBe(unit);
    expect(invalidBuilder).toBeUndefined();
  });

  it('retains meaningful exposure and explicit override chains in composed mode', async () => {
    const before = await TestBed.sociable(EmptyLeafRoot).expose(EmptyLeaf).compose().compile();
    const after = await TestBed.sociable(EmptyLeafRoot).compose().expose(EmptyLeaf).compile();
    const overridden = await TestBed.sociable(Service)
      .compose()
      .mock(Leaf)
      .impl((stub) => ({ prefix: stub().mockReturnValue('mock:') }))
      .compile();
    expect(before.unit.leaf).toBeInstanceOf(EmptyLeaf);
    expect(after.unit.leaf).toBeInstanceOf(EmptyLeaf);
    expect(overridden.unit.repository).toBeInstanceOf(Repository);
    expect(overridden.unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(overridden.unit.read()).toBe('mock:value');
    expect(overridden.unitRef.get(Leaf).prefix).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the original sociable builder', async () => {
    const original = TestBed.sociable(Service);
    const composed = original.compose();

    const unchanged = await original.compile();
    const recursive = await composed.compile();

    expect(unchanged.unit.repository).not.toBeInstanceOf(Repository);
    expect(recursive.unit.repository).toBeInstanceOf(Repository);
    expect(recursive.unit.repository.leaf).toBeInstanceOf(Leaf);
  });
});
