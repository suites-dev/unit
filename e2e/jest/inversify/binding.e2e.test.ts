import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { inject, injectable, named } from 'inversify';
import { TestBed } from '@suites/unit';

const REPOSITORY = Symbol('repository');

@injectable()
class Leaf {
  prefix(): string {
    return 'live:';
  }
}

@injectable()
class Repository {
  constructor(@inject(Leaf) readonly leaf: Leaf) {}
  read(): string {
    return this.leaf.prefix() + 'value';
  }
}

@injectable()
class Root {
  constructor(
    @inject(REPOSITORY) readonly repository: Repository,
    @inject(REPOSITORY) readonly repeated: Repository
  ) {}
  read(): string {
    return this.repository.read();
  }
}

describe('V5 explicit token bindings', () => {
  it('constructs bindings in selective mode in every supported order', async () => {
    const direct = await TestBed.sociable(Root).bind(REPOSITORY, Repository).compile();
    const exposedFirst = await TestBed.sociable(Root)
      .expose(Leaf)
      .bind(REPOSITORY, Repository)
      .compile();
    const boundFirst = await TestBed.sociable(Root)
      .bind(REPOSITORY, Repository)
      .expose(Leaf)
      .compile();
    expect(direct.unit.repository).toBeInstanceOf(Repository);
    expect(direct.unit.repository).toBe(direct.unit.repeated);
    expect(direct.unit.repository.leaf).not.toBeInstanceOf(Leaf);
    expect(() => direct.unitRef.get(REPOSITORY)).toThrow(/exposed dependency/);
    expect(exposedFirst.unit.read()).toBe('live:value');
    expect(boundFirst.unit.read()).toBe('live:value');
  });

  it('follows bindings recursively in composed mode in either order', async () => {
    const boundFirst = await TestBed.sociable(Root)
      .bind(REPOSITORY, Repository)
      .compose()
      .compile();
    const composedFirst = await TestBed.sociable(Root)
      .compose()
      .bind(REPOSITORY, Repository)
      .compile();
    expect(boundFirst.unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(boundFirst.unit.read()).toBe('live:value');
    expect(composedFirst.unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(composedFirst.unit.read()).toBe('live:value');
  });

  it('keeps one token-wide binding distinct per metadata qualifier', async () => {
    @injectable()
    class QualifiedRoot {
      constructor(
        @inject(REPOSITORY) @named('primary') readonly primary: Repository,
        @inject(REPOSITORY) @named('primary') readonly repeated: Repository,
        @inject(REPOSITORY) @named('secondary') readonly secondary: Repository
      ) {}
    }

    const { unit } = await TestBed.sociable(QualifiedRoot)
      .bind(REPOSITORY, Repository)
      .compose()
      .compile();
    expect(unit.primary).toBe(unit.repeated);
    expect(unit.primary).not.toBe(unit.secondary);
    expect(unit.primary.leaf).toBeInstanceOf(Leaf);
    expect(unit.secondary.leaf).toBeInstanceOf(Leaf);
  });
});
