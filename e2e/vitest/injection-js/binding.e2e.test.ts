import 'reflect-metadata';
import { Inject, Injectable } from 'injection-js';
import { TestBed } from '@suites/unit';
import { describe, expect, it } from 'vitest';

const REPOSITORY = Symbol('repository');

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
class Root {
  constructor(
    @Inject(REPOSITORY) readonly repository: Repository,
    @Inject(REPOSITORY) readonly repeated: Repository
  ) {}
  read(): string {
    return this.repository.read();
  }
}

describe('v5 explicit token bindings', () => {
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
});
