# @suites/di.injectionjs

Test InjectionJS services with [Suites](https://suites.dev). Suites reads constructor dependencies and supplies mocks through Jest or Vitest.

Supports InjectionJS 2.6.1 through 2.x and Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. This adapter supports **constructor injection**. Contextual `inject()` calls, including class field initializers, are not supported.

## Install

For Jest:

```sh
pnpm add -D @suites/unit @suites/di.injectionjs @suites/doubles.jest
```

For Vitest:

```sh
pnpm add -D @suites/unit @suites/di.injectionjs @suites/doubles.vitest
```

Your application must also have `injection-js` and `reflect-metadata` installed. Use a matching Suites release for the unit package and adapters.

Add `suites.d.ts` to the files included by your test TypeScript configuration:

```ts
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.injectionjs/metadata" />
```

For Vitest, replace the first reference with `@suites/doubles.vitest/unit`. Keep one doubles adapter reference and one DI adapter reference.

Enable constructor metadata in your test compiler configuration:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Your runner's TypeScript transformer must emit decorator metadata too. Start with the [Jest or Vitest runner setup](https://suites.dev/docs/get-started/installation/).

For Vitest, also add `injection-js` to `test.server.deps.external` in `vitest.config.ts`. This makes Vitest and the adapter use the same native InjectionJS module, preserving decorator and token identity:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: { deps: { external: ['injection-js'] } },
  },
  // Keep your existing decorator metadata transformer and test settings.
});
```

## Write a test

Create `user.service.ts`:

```ts
import 'reflect-metadata';
import { Inject, Injectable, InjectionToken } from 'injection-js';

export interface UserRepository {
  findName(id: string): Promise<string>;
}

export const USER_REPOSITORY = new InjectionToken<UserRepository>('UserRepository');

@Injectable()
export class UserService {
  constructor(@Inject(USER_REPOSITORY) private readonly repository: UserRepository) {}

  findName(id: string): Promise<string> {
    return this.repository.findName(id);
  }
}
```

Create `user.service.test.ts`:

```ts
import { expect, it } from '@jest/globals';
import { TestBed } from '@suites/unit';
import { USER_REPOSITORY, UserService } from './user.service.js';
import type { UserRepository } from './user.service.js';

it('returns the repository result', async () => {
  const { unit, unitRef } = await TestBed.solitary(UserService).compile();
  const repository = unitRef.get<UserRepository>(USER_REPOSITORY);
  repository.findName.mockResolvedValue('Alice');

  await expect(unit.findName('1')).resolves.toBe('Alice');
  expect(repository.findName).toHaveBeenCalledWith('1');
});
```

For Vitest, import `expect` and `it` from `vitest`. The test passes with a generated repository mock; no production injector is created.

## Supported constructor patterns

- Class dependencies discovered through decorator metadata.
- `@Inject()` with a class, nonempty string, symbol, or `InjectionToken`.
- `forwardRef()` constructor tokens, resolved to their underlying token.
- Static `parameters` and lowered `ctorParameters` metadata supported by InjectionJS.
- `.mock(token).impl(...)` and `.mock(token).final(...)` overrides.
- `TestBed.sociable(...).expose(...)` for real class dependencies.

Use an explicit dependency type with `InjectionToken` lookups and overrides, such as `unitRef.get<UserRepository>(USER_REPOSITORY)`. Tokens are compared by identity: two `InjectionToken` instances with the same description remain distinct.

## Scope and limitations

Suites builds a flat test container. `@Optional()`, `@Self()`, `@SkipSelf()`, and `@Host()` do not reproduce production injector lookup rules. Optional dependencies are mocked like other constructor dependencies; use `.mock<Dependency | null>(token).final(null)` to test an absent optional dependency.

Suites does not consume InjectionJS provider configuration, run provider factories, collect multi-providers, or resolve injector hierarchies. Supply values or implementations explicitly through `.mock(...)` when needed. Arbitrary object, numeric, and boolean tokens are not supported; use `InjectionToken` for object identity.

Classes that use contextual `inject()` cannot be constructed by this adapter. Use constructor injection for the class under test and any real dependencies exposed in sociable tests, or test those classes with InjectionJS's own injector.

## Next steps

- [Configure mocks and final values](https://suites.dev/docs/api-reference/mock-configuration/)
- [InjectionJS documentation](https://github.com/mgechev/injection-js)
- [Report an issue](https://github.com/suites-dev/unit/issues)

Apache-2.0
