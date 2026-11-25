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
    const typeChecks = () => {
      // @ts-expect-error Binding preserves the subject type.
      unit.missingMethod();
      // @ts-expect-error Selective exposure accepts classes, not token bindings.
      TestBed.sociable(Root).expose(REPOSITORY, Repository);
      // @ts-expect-error A class-token implementation must satisfy the token type.
      TestBed.sociable(Root).expose(Leaf).bind(Repository, Leaf);
      // @ts-expect-error A symbol binding is checked when its value type is explicit.
      TestBed.sociable(Root).compose().bind<Repository>(REPOSITORY, Leaf);
    };
    expect(typeChecks).toBeDefined();
  });

  it('recursively constructs the dependencies of a bound repository in composed mode', async () => {
    const { unit } = await TestBed.sociable(Root).compose().bind(REPOSITORY, Repository).compile();
    expect(unit.repository.leaf).toBeInstanceOf(Leaf);
    expect(unit.read()).toBe('live:value');
  });

  it('does not alias distinct tokens that share an implementation', async () => {
    const { unit } = await TestBed.sociable(IdentityRoot)
      .compose()
      .bind(REPOSITORY, Repository)
      .bind(SECONDARY_REPOSITORY, Repository)
      .compile();

    expect(unit.primary).toBeInstanceOf(Repository);
    expect(unit.secondary).toBeInstanceOf(Repository);
    expect(unit.primary).not.toBe(unit.secondary);
  });

  it('supports string, abstract-class, and property token bindings', async () => {
    const tokenKinds = await TestBed.sociable(TokenKindsRoot)
      .compose()
      .bind('repository', PortRepository)
      .bind(RepositoryPort, PortRepository)
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

  it('rejects an unqualified override before constructing the subject in both modes', async () => {
    let constructions = 0;
    @Injectable()
    class Subject {
      constructor(@Inject(REPOSITORY) readonly repository: Repository) {
        constructions++;
      }
    }
    const selector = TestBed.sociable(Subject);
    for (const mode of [selector.expose(Leaf), selector.compose()]) {
      const bound = mode.bind(REPOSITORY, Repository);
      await expect(
        bound
          .mock<Repository>(REPOSITORY)
          .impl((stub) => ({ read: stub() }))
          .compile()
      ).rejects.toThrow(/conflicting.*repository/i);
      await expect(
        bound
          .mock<Repository>(REPOSITORY)
          .final({ read: () => 'supplied' })
          .compile()
      ).rejects.toThrow(/conflicting.*repository/i);
    }
    expect(constructions).toBe(0);
  });

  it('rejects contradictory bindings for one token', async () => {
    await expect(
      TestBed.sociable(Root)
        .expose(Leaf)
        .bind(REPOSITORY, Repository)
        .bind(REPOSITORY, AlternativeRepository)
        .compile()
    ).rejects.toThrow(/binding|conflict/i);
  });
});
