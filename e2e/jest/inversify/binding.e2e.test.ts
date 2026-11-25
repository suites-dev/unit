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

describe('v5 explicit token bindings', () => {
  it('uses a bound repository and its exposed dependency in selective mode', async () => {
    const { unit, unitRef } = await TestBed.sociable(Root)
      .expose(Leaf)
      .bind(REPOSITORY, Repository)
      .compile();
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository).toBe(unit.repeated);
    expect(unit.read()).toBe('live:value');
    expect(() => unitRef.get(REPOSITORY)).toThrow(/exposed dependency/);
  });

  it('recursively constructs the dependencies of a bound repository in composed mode', async () => {
    const { unit } = await TestBed.sociable(Root).compose().bind(REPOSITORY, Repository).compile();
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('live:value');
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
      .compose()
      .bind(REPOSITORY, Repository)
      .compile();
    expect(unit.primary).toBe(unit.repeated);
    expect(unit.primary).not.toBe(unit.secondary);
    expect(unit.primary.leaf).toBeInstanceOf(Leaf);
    expect(unit.secondary.leaf).toBeInstanceOf(Leaf);
  });
});
