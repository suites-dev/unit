import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import {
  Inject,
  Injectable,
  InjectionToken,
  Optional,
  Self,
  SkipSelf,
  forwardRef,
  inject,
} from 'injection-js';
import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/unit';

@Injectable()
class Repository {
  find(): string {
    return 'production';
  }
}
const TOKEN = new InjectionToken<Repository>('repository');
const OTHER = new InjectionToken<Repository>('repository');
const SYMBOL = Symbol('repository');
const CONFIG = new InjectionToken<string>('config');

@Injectable()
class Service {
  constructor(
    readonly repository: Repository,
    @Inject('NAMED') readonly named: Repository,
    @Inject(SYMBOL) readonly symbolic: Repository,
    @Inject(TOKEN) readonly token: Repository,
    @Inject(OTHER) readonly other: Repository,
    @Inject(forwardRef(() => Repository)) readonly forward: Repository,
    @Inject(CONFIG) readonly config: string
  ) {}
  read() {
    return this.token.find() + ':' + this.config;
  }
}

describe('published InjectionJS adapter', () => {
  it('distinguishes finalized and mocked tokens with identical descriptions', async () => {
    const { unit, unitRef } = await TestBed.solitary(Service)
      .mock<Repository>(TOKEN)
      .final({ find: () => 'final' })
      .mock<string>(CONFIG)
      .final('test')
      .compile();
    expect(unit.token.find()).toBe('final');
    expect(unit.other).toBe(unitRef.get<Repository>(OTHER));
    expect(() => unitRef.get(TOKEN)).toThrow(/faked dependency/);
  });

  it('allows explicitly absent optional constructor dependencies', async () => {
    @Injectable()
    class OptionalService {
      constructor(@Optional() @Inject(TOKEN) readonly repository: Repository | null) {}
    }
    const { unit } = await TestBed.solitary(OptionalService)
      .mock<Repository | null>(TOKEN)
      .final(null)
      .compile();
    expect(unit.repository).toBeNull();
  });

  it('mocks class, string, symbol and InjectionToken dependencies', async () => {
    const { unit, unitRef } = await TestBed.solitary(Service)
      .mock<Repository>(TOKEN)
      .impl((stub) => ({ find: stub().mockReturnValue('mock') }))
      .mock<string>(CONFIG)
      .final('test')
      .compile();
    const repository: Mocked<Repository> = unitRef.get(Repository);
    repository.find.mockReturnValue('class mock');
    expect(unit.repository.find()).toBe('class mock');
    expect(unit.named).toBe(unitRef.get<Repository>('NAMED'));
    expect(unit.symbolic).toBe(unitRef.get<Repository>(SYMBOL));
    expect(unit.token).toBe(unitRef.get<Repository>(TOKEN));
    expect(unit.forward).toBe(repository);
    expect(unit.other).not.toBe(unit.token);
    expect(unit.read()).toBe('mock:test');
    expect(unitRef.get<Repository>(TOKEN).find).toHaveBeenCalledTimes(1);
    expect(() => unitRef.get(CONFIG)).toThrow(/faked dependency/);
    expect(() => unitRef.get(new InjectionToken('missing'))).toThrow(/InjectionToken missing/);
  });

  it('supports constructor dependencies in a sociable test', async () => {
    @Injectable()
    class ServiceWithRepository {
      constructor(readonly repository: Repository) {}
    }
    const { unit } = await TestBed.sociable(ServiceWithRepository).expose(Repository).compile();
    expect(unit.repository).toBeInstanceOf(Repository);
    expect(unit.repository.find()).toBe('production');
  });

  it('resolves static constructor metadata and forward references', async () => {
    class StaticService {
      static parameters = [[new Inject(forwardRef(() => Repository))]];
      constructor(readonly repository: Repository) {}
    }
    const { unit, unitRef } = await TestBed.solitary(StaticService).compile();
    expect(unit.repository).toBe(unitRef.get(Repository));
  });

  it('mocks optional dependencies in the flat test container', async () => {
    @Injectable()
    class Modified {
      constructor(
        @Optional() @Self() readonly repository: Repository,
        @SkipSelf() @Inject(TOKEN) readonly token: Repository
      ) {}
    }
    const { unit, unitRef } = await TestBed.solitary(Modified).compile();
    expect(unit.repository).toBe(unitRef.get(Repository));
    expect(unit.token).toBe(unitRef.get<Repository>(TOKEN));
  });

  it('rejects erased constructor types with an actionable error', async () => {
    @Injectable()
    class Erased {
      constructor(readonly repository: { find(): string }) {}
    }
    await expect(TestBed.solitary(Erased).compile()).rejects.toThrow(/Use @Inject\(token\)/);
  });

  it('does not claim to support contextual inject()', async () => {
    class Contextual {
      repository = inject(Repository);
    }
    await expect(TestBed.solitary(Contextual).compile()).rejects.toThrow(/injection context/i);
  });
});

// This function is checked by tsc without executing the intentionally invalid calls.
function checkPublicTypes() {
  const builder = TestBed.solitary(Service);
  builder.mock<Repository>(TOKEN).impl((stub) => ({ find: stub().mockReturnValue('ok') }));
  // @ts-expect-error arbitrary object tokens are not registered
  builder.mock({});
  // @ts-expect-error InjectionJS has no identifier metadata
  builder.mock(TOKEN, { tag: 'production' });
  // @ts-expect-error a string token cannot be finalized with a number
  builder.mock<string>(CONFIG).final(42);
}
void checkPublicTypes;
