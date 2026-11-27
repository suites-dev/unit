import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { Inject, Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';

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
});
