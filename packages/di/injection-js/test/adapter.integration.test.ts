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
import { UndefinedDependency, UndefinedDependencyError } from '@suites/types.di';
import type { InjectableIdentifier } from '@suites/types.di';
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

describe('InjectionJS constructor adapter', () => {
  it('uses the same token identities and order as the production resolver', () => {
    const registry = adapter.inspect(Service);
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
    expect(registry.resolve(TOKEN as unknown as InjectableIdentifier)).toEqual({
      identifier: TOKEN,
      value: UndefinedDependency,
      type: 'PARAM',
    });
    expect(registry.resolve('missing')).toBeUndefined();
  });

  it('keeps different InjectionTokens with the same description distinct', () => {
    const other = new InjectionToken('repository');
    expect(
      adapter.inspect(Service).resolve(other as unknown as InjectableIdentifier)
    ).toBeUndefined();
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
      adapter
        .inspect(StaticService)
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
    expect(adapter.inspect(LoweredService).list()[0].identifier).toBe(TOKEN);
  });

  it('does not run constructors when inspecting metadata', () => {
    @Injectable()
    class SideEffect {
      constructor(readonly repository: Repository) {
        throw new Error('must not instantiate');
      }
    }
    expect(adapter.inspect(SideEffect).list()[0].identifier).toBe(Repository);
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
      adapter
        .inspect(Modified)
        .list()
        .map(({ identifier }) => identifier)
    ).toEqual([Repository, TOKEN]);
  });

  it('accepts classes without dependencies', () => {
    class Empty {}
    expect(adapter.inspect(Empty).list()).toEqual([]);
  });

  it('rejects missing metadata instead of silently injecting undefined', () => {
    class Missing {
      constructor(readonly value: unknown) {}
    }
    expect(() => adapter.inspect(Missing)).toThrow(UndefinedDependencyError);
  });

  it('rejects erased interface metadata instead of mocking Object', () => {
    @Injectable()
    class Erased {
      constructor(readonly value: { name: string }) {}
    }
    expect(() => adapter.inspect(Erased)).toThrow(UndefinedDependencyError);
  });

  it('rejects an empty token as InjectionJS does, instead of falling back to String', () => {
    @Injectable()
    class EmptyToken {
      constructor(@Inject('') readonly value: string) {}
    }
    expect(() => adapter.inspect(EmptyToken)).toThrow(UndefinedDependencyError);
  });

  it.each([123, {}, true])('rejects unsupported token %p', (token) => {
    @Injectable()
    class Unsupported {
      constructor(@Inject(token) readonly value: unknown) {}
    }
    expect(() => adapter.inspect(Unsupported)).toThrow(
      /Use a class, string, symbol, or InjectionToken/
    );
  });
});
