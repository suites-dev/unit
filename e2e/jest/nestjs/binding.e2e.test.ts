import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { Inject, Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';

const REPOSITORY = Symbol('repository');
const SECONDARY_REPOSITORY = Symbol('repository');

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
class AlternativeRepository extends Repository {}

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

@Injectable()
class IdentityRoot {
  constructor(
    @Inject(REPOSITORY) readonly primary: Repository,
    @Inject(SECONDARY_REPOSITORY) readonly secondary: Repository
  ) {}
}

abstract class RepositoryPort {
  abstract read(): string;
}

@Injectable()
class PortRepository extends RepositoryPort {
  constructor(readonly leaf: Leaf) {
    super();
  }

  read(): string {
    return this.leaf.prefix() + 'port';
  }
}

@Injectable()
class TokenKindsRoot {
  constructor(
    @Inject('repository') readonly stringToken: RepositoryPort,
    @Inject(RepositoryPort) readonly abstractToken: RepositoryPort
  ) {}
}

@Injectable()
class PropertyRoot {
  @Inject(REPOSITORY) repository!: Repository;
}

describe('V5 explicit token bindings', () => {
  it('constructs a bound implementation in selective mode in every supported order', async () => {
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

    const typeChecks = () => {
      // @ts-expect-error Binding preserves the subject type.
      direct.unit.missingMethod();
      // @ts-expect-error Selective exposure accepts classes, not token bindings.
      TestBed.sociable(Root).expose(REPOSITORY, Repository);
      // @ts-expect-error A class-token implementation must satisfy the token type.
      TestBed.sociable(Root).bind(Repository, Leaf);
      // @ts-expect-error A symbol binding is checked when its value type is explicit.
      TestBed.sociable(Root).bind<Repository>(REPOSITORY, Leaf);
    };
    expect(typeChecks).toBeDefined();
  });

  it('follows a binding recursively in composed mode in either order', async () => {
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

  it('does not alias distinct tokens that share an implementation', async () => {
    const { unit } = await TestBed.sociable(IdentityRoot)
      .bind(REPOSITORY, Repository)
      .bind(SECONDARY_REPOSITORY, Repository)
      .compose()
      .compile();

    expect(unit.primary).toBeInstanceOf(Repository);
    expect(unit.secondary).toBeInstanceOf(Repository);
    expect(unit.primary).not.toBe(unit.secondary);
  });

  it('supports string, abstract-class, and property token bindings', async () => {
    const tokenKinds = await TestBed.sociable(TokenKindsRoot)
      .bind('repository', PortRepository)
      .bind(RepositoryPort, PortRepository)
      .compose()
      .compile();
    const property = await TestBed.sociable(PropertyRoot)
      .compose()
      .bind(REPOSITORY, Repository)
      .compile();

    expect(tokenKinds.unit.stringToken).toBeInstanceOf(PortRepository);
    expect(tokenKinds.unit.abstractToken).toBeInstanceOf(PortRepository);
    expect(tokenKinds.unit.stringToken).not.toBe(tokenKinds.unit.abstractToken);
    expect(tokenKinds.unit.stringToken.read()).toBe('live:port');
    expect(property.unit.repository).toBeInstanceOf(Repository);
    expect(property.unit.repository.leaf).toBeInstanceOf(Leaf);
  });

  it('lets an explicit final override win and rejects contradictory bindings', async () => {
    const supplied = { read: () => 'supplied' };
    const overridden = await TestBed.sociable(Root)
      .bind(REPOSITORY, Repository)
      .mock<Repository>(REPOSITORY)
      .final(supplied)
      .compose()
      .compile();

    expect(overridden.unit.repository).toBe(supplied);
    expect(overridden.unit.read()).toBe('supplied');

    await expect(
      TestBed.sociable(Root)
        .bind(REPOSITORY, Repository)
        .bind(REPOSITORY, AlternativeRepository)
        .compile()
    ).rejects.toThrow(/binding|conflict/i);
  });
});
