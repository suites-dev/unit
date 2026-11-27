import 'reflect-metadata';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { UndefinedTokenError } from '@suites/types.di';
import { TestBed } from '@suites/unit';

@Injectable()
class ServiceWithMissingToken {
  constructor(@Inject(undefined) readonly dependency: unknown) {}
}

describe('UndefinedTokenError', () => {
  it('exposes ER31 when constructed from the public package', () => {
    const error = new UndefinedTokenError('A constructor dependency needs a token.');

    expect(error).toMatchObject({
      name: 'UndefinedTokenError',
      code: 'ER31',
      message: 'Undefined token (code ER31)\nA constructor dependency needs a token.',
    });
  });

  it('reports ER31 when NestJS cannot detect a declared constructor token', async () => {
    const compilation = TestBed.solitary(ServiceWithMissingToken).compile();

    await expect(compilation).rejects.toBeInstanceOf(UndefinedTokenError);
    await expect(compilation).rejects.toMatchObject({
      name: 'UndefinedTokenError',
      code: 'ER31',
      message: expect.stringMatching(
        /^Undefined token \(code ER31\)\n[\s\S]*dependency at index \[0\]/
      ),
    });
  });
});

describe('NestJS metadata diagnostics', () => {
  it('reports the root, declaring class and symbol property for an undefined forward reference', async () => {
    const property = Symbol('repository');
    @Injectable()
    class Handler {
      @Inject(forwardRef(() => undefined))
      readonly [property]!: unknown;
    }
    @Injectable()
    class Checkout {
      constructor(readonly handler: Handler) {}
    }
    await expect(TestBed.sociable(Checkout).expose(Handler).compile()).rejects.toMatchObject({
      code: 'ER31',
      context: {
        root: Checkout,
        failure: { target: Handler, location: { kind: 'property', key: property } },
      },
    });
  });

  it('reads an exposed dependency once per compile and preserves a throwing forward reference', async () => {
    @Injectable()
    class Repository {}
    const resolve = jest.fn(() => Repository);
    @Injectable()
    class Handler {
      constructor(@Inject(forwardRef(resolve)) readonly repository: Repository) {}
    }
    @Injectable()
    class Checkout {
      constructor(readonly handler: Handler) {}
    }
    const build = () => TestBed.sociable(Checkout).expose(Handler).compile();
    await build();
    expect(resolve).toHaveBeenCalledTimes(1);
    const cause = new Error('cannot read application configuration');
    resolve.mockImplementation(() => {
      throw cause;
    });
    await expect(build()).rejects.toBe(cause);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('keeps ER30 for a missing reflected dependency', async () => {
    @Injectable()
    class Checkout {
      constructor(readonly handler: undefined) {}
    }
    await expect(TestBed.solitary(Checkout).compile()).rejects.toMatchObject({
      name: 'UndefinedDependencyError',
      code: 'ER30',
      context: {
        root: Checkout,
        failure: { target: Checkout, location: { kind: 'parameter', index: 0 } },
      },
    });
  });
});

it('mocks a solitary collaborator without inspecting its own constructor', async () => {
  class Repository {
    constructor(readonly missing: unknown) {}
  }
  @Injectable()
  class Checkout {
    constructor(readonly repository: Repository) {}
  }
  const { unit, unitRef } = await TestBed.solitary(Checkout).compile();
  expect(unit.repository).toBe(unitRef.get(Repository));
});
