import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import { Inject, Injectable, InjectionToken } from 'injection-js';
import { TestBed } from '@suites/unit';

interface RepositoryPort {
  read(): string;
}

const REPOSITORY = new InjectionToken<RepositoryPort>('repository');

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
      .bind<RepositoryPort>(REPOSITORY, Repository)
      .compile();
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository).toBe(unit.repeated);
    expect(unit.read()).toBe('live:value');
    expect(() => unitRef.get(REPOSITORY)).toThrow(/exposed dependency/);
  });

  it('rejects declarations for a different InjectionToken with the same description', async () => {
    const absent = new InjectionToken<RepositoryPort>('repository');
    const configure = jest.fn(() => ({ read: () => 'unused' }));
    const selector = TestBed.sociable(Root);
    for (const mode of [selector.expose(Leaf), selector.compose()]) {
      const bound = mode.bind<RepositoryPort>(REPOSITORY, Repository);
      await expect(bound.mock(absent).impl(configure).compile()).rejects.toMatchObject({
        code: 'ER043',
      });
      await expect(bound.bind<RepositoryPort>(absent, Repository).compile()).rejects.toMatchObject({
        code: 'ER043',
      });
    }
    expect(configure).not.toHaveBeenCalled();
  });

  it('recursively constructs the dependencies of a bound repository in composed mode', async () => {
    const { unit } = await TestBed.sociable(Root)
      .compose()
      .bind<RepositoryPort>(REPOSITORY, Repository)
      .compile();
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('live:value');
  });
});
