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

class EmptyLeaf {}

class AnotherEmptyLeaf {}

@Injectable()
class EmptyLeafRoot {
  constructor(
    readonly leaf: EmptyLeaf,
    readonly anotherLeaf: AnotherEmptyLeaf
  ) {}
}

describe('v5 opt-in composition', () => {
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

  it('keeps variadic selective exposure separate from composed overrides', async () => {
    const selective = TestBed.sociable(EmptyLeafRoot).expose(EmptyLeaf, AnotherEmptyLeaf);
    const composed = TestBed.sociable(Service).compose();
    const exposed = await selective.compile();
    const overridden = await composed
      .mock(Leaf)
      .impl((stub) => ({ prefix: stub().mockReturnValue('mock:') }))
      .compile();
    // @ts-expect-error All exposed classes are supplied in one call.
    expect(selective.expose).toBeUndefined();
    // @ts-expect-error Selective mode excludes recursive composition.
    const invalidCompose = selective.compose;
    // @ts-expect-error Composed mode excludes selective exposure.
    const invalidExpose = composed.expose;
    expect(invalidCompose).toBeUndefined();
    expect(invalidExpose).toBeUndefined();
    expect(() => {
      // @ts-expect-error Selective mode requires at least one dependency.
      TestBed.sociable(Service).expose();
    }).toThrow('Selective exposure requires at least one dependency');
    expect(exposed.unit.leaf).toBeInstanceOf(EmptyLeaf);
    expect(exposed.unit.anotherLeaf).toBeInstanceOf(AnotherEmptyLeaf);
    expect(overridden.unit.repository).toBeInstanceOf(Repository);
    expect(overridden.unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(overridden.unit.read()).toBe('mock:value');
    expect(overridden.unitRef.get(Leaf).prefix).toHaveBeenCalledTimes(1);
  });

  it('requires mode selection before configuring or compiling', () => {
    const selector = TestBed.sociable(Service);
    // @ts-expect-error Choose expose or compose before compiling.
    expect(selector.compile).toBeUndefined();
    // @ts-expect-error Choose a mode before declaring a mock.
    expect(selector.mock).toBeUndefined();
    // @ts-expect-error Bindings belong to a selected mode.
    expect(selector.bind).toBeUndefined();
    // @ts-expect-error Forbidden boundaries belong to composed tests.
    expect(selector.forbid).toBeUndefined();
  });
});
