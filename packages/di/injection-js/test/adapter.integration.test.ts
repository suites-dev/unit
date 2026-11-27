import type { Type } from '@suites/types.common';
import { ok } from 'node:assert/strict';
import 'reflect-metadata';
import {
  forwardRef,
  Inject,
  Injectable,
  InjectionToken,
  Optional,
  ReflectiveInjector,
  Self,
  SkipSelf,
} from 'injection-js';
import { UndefinedDependency } from '@suites/types.di';
import type {} from '../metadata.js';
import { adapter } from '../src/index.js';

@Injectable()
class Repository {
  find() {
    return 'production';
  }
}
const TOKEN = new InjectionToken<Repository>('repository');
const SYMBOL = Symbol('repository');

@Injectable()
class Service {
  constructor(
    readonly repository: Repository,
    @Inject('REPO') readonly named: Repository,
    @Inject(SYMBOL) readonly symbolic: Repository,
    @Inject(TOKEN) readonly token: Repository,
    @Inject(forwardRef(() => Repository)) readonly forward: unknown
  ) {}
}

function registryFor(target: Type) {
  const result = adapter.inspect(target);
  ok(result.kind === 'success');
  return result.registry;
}

describe('InjectionJS constructor adapter', () => {
  it('positively identifies only InjectionJS injectable classes for composition', () => {
    class Unmarked {}

    expect(adapter.canAutoConstruct?.(Service)).toBe(true);
    expect(adapter.canAutoConstruct?.(Unmarked)).toBe(false);
  });

  it('uses the same token identities and order as the production resolver', () => {
    const registry = registryFor(Service);
    const production = ReflectiveInjector.resolve([Service])[0].resolvedFactories[0].dependencies;
    expect(registry.list().map(({ identifier }) => identifier)).toEqual(
      production.map(({ key }) => key.token)
    );
    expect(registry.list().map(({ identifier }) => identifier)).toEqual([
      Repository,
      'REPO',
      SYMBOL,
      TOKEN,
      Repository,
    ]);
    expect(registry.resolve(Repository)).toEqual({
      identifier: Repository,
      value: Repository,
      type: 'PARAM',
    });
    expect(registry.resolve(TOKEN)).toEqual({
      identifier: TOKEN,
      value: UndefinedDependency,
      type: 'PARAM',
    });
    expect(registry.resolve('missing')).toBeUndefined();
  });

  it('keeps different InjectionTokens with the same description distinct', () => {
    const other = new InjectionToken('repository');
    expect(registryFor(Service).resolve(other)).toBeUndefined();
  });

  it('reads the public static parameters format', () => {
    class StaticService {
      static parameters = [[new Inject(TOKEN)], [Repository]];
      constructor(
        readonly token: unknown,
        readonly repository: Repository
      ) {}
    }
    expect(
      registryFor(StaticService)
        .list()
        .map(({ identifier }) => identifier)
    ).toEqual([TOKEN, Repository]);
  });

  it('reads lowered constructor decorator metadata', () => {
    class LoweredService {
      static ctorParameters = () => [
        { type: Object, decorators: [{ type: Inject, args: [TOKEN] }] },
      ];
      constructor(readonly token: unknown) {}
    }
    expect(registryFor(LoweredService).list()[0].identifier).toBe(TOKEN);
  });

  it('does not run constructors when inspecting metadata', () => {
    @Injectable()
    class SideEffect {
      constructor(readonly repository: Repository) {
        throw new Error('must not instantiate');
      }
    }
    expect(registryFor(SideEffect).list()[0].identifier).toBe(Repository);
  });

  it('treats resolution modifiers as tokens in a flat test container', () => {
    @Injectable()
    class Modified {
      constructor(
        @Optional() @Self() readonly one: Repository,
        @SkipSelf() @Inject(TOKEN) readonly two: unknown
      ) {}
    }
    expect(
      registryFor(Modified)
        .list()
        .map(({ identifier }) => identifier)
    ).toEqual([Repository, TOKEN]);
  });

  it('accepts classes without dependencies', () => {
    class Empty {}
    expect(registryFor(Empty).list()).toEqual([]);
  });

  it('rejects missing metadata instead of silently injecting undefined', () => {
    class Missing {
      constructor(readonly value: unknown) {}
    }
    expect(adapter.inspect(Missing)).toMatchObject({ kind: 'failure', target: Missing });
  });

  it('rejects erased interface metadata instead of mocking Object', () => {
    @Injectable()
    class Erased {
      constructor(readonly value: { name: string }) {}
    }
    expect(adapter.inspect(Erased)).toMatchObject({ kind: 'failure', target: Erased });
  });

  it('rejects an empty token as InjectionJS does, instead of falling back to String', () => {
    @Injectable()
    class EmptyToken {
      constructor(@Inject('') readonly value: string) {}
    }
    expect(adapter.inspect(EmptyToken)).toMatchObject({ kind: 'failure', target: EmptyToken });
  });

  it.each([123, {}, true])('rejects unsupported token %p', (token) => {
    @Injectable()
    class Unsupported {
      constructor(@Inject(token) readonly value: unknown) {}
    }
    expect(adapter.inspect(Unsupported)).toMatchObject({
      kind: 'failure',
      target: Unsupported,
      reason: 'unsupported-token',
    });
  });
  it('returns the index and framework cause for an undefined lazy token', () => {
    @Injectable()
    class MissingToken {
      constructor(@Inject(forwardRef(() => undefined)) readonly port: unknown) {}
    }
    expect(adapter.inspect(MissingToken)).toMatchObject({
      kind: 'failure',
      reason: 'undefined-token',
      target: MissingToken,
      location: { kind: 'parameter', index: 0 },
      cause: expect.any(Error),
    });
  });

  it('preserves exceptions from a lazy token', () => {
    const cause = new Error('application error');
    @Injectable()
    class Broken {
      constructor(
        @Inject(
          forwardRef(() => {
            throw cause;
          })
        )
        readonly port: unknown
      ) {}
    }
    let caught: unknown;
    try {
      adapter.inspect(Broken);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(cause);
  });
});
