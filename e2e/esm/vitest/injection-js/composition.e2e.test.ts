import 'reflect-metadata';
import { Injectable } from 'injection-js';
import { TestBed } from '@suites/unit';
import { describe, expect, it } from 'vitest';

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

describe('v5 opt-in composition', () => {
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
  it('retains explicit override chains and excludes selective exposure', async () => {
    const composed = TestBed.sociable(Service).compose();
    const selective = TestBed.sociable(Service).expose(Repository);
    const overridden = await composed
      .mock(Leaf)
      .impl((stub) => ({ prefix: stub().mockReturnValue('mock:') }))
      .compile();
    // @ts-expect-error Composed mode excludes selective exposure.
    const invalidExpose = composed.expose;
    // @ts-expect-error All exposed classes are supplied in one call.
    expect(selective.expose).toBeUndefined();
    // @ts-expect-error Selective mode excludes recursive composition.
    const invalidCompose = selective.compose;
    expect(invalidExpose).toBeUndefined();
    expect(invalidCompose).toBeUndefined();
    expect(overridden.unit.repository).toBeInstanceOf(Repository);
    expect(overridden.unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(overridden.unit.read()).toBe('mock:value');
    expect(overridden.unitRef.get(Leaf).prefix).toHaveBeenCalledTimes(1);
  });
});
