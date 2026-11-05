<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/di.injectionjs</h1>

<p align="center">
InjectionJS dependency injection adapter for Suites
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/di.injectionjs"><img src="https://img.shields.io/npm/dm/@suites/di.injectionjs.svg?label=%40suites%2Fdi.injectionjs" alt="npm downloads" /></a>
</div>

<h3 align="center">
  <a href="https://suites.dev/docs/">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://suites.dev/docs/get-started/quickstart/">Getting Started</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://suites.dev/docs/get-started/installation/">Installation</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/suites-dev/suites-unit-examples">Examples</a>
</h3>

Test InjectionJS services with Suites. The adapter reads dependency metadata so `TestBed` can supply typed mocks without creating your production container.

## Installation

For Jest:

```sh
pnpm add -D @suites/unit @suites/di.injectionjs @suites/doubles.jest
```

For Vitest:

```sh
pnpm add -D @suites/unit @suites/di.injectionjs @suites/doubles.vitest
```

Your application must also have `injection-js` and `reflect-metadata` installed. Supported InjectionJS versions: `^2.6.1`.

Suites 4 supports Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, with CommonJS and ESM package entry points.

## Configuration

Create `suites.d.ts` and include it in your test `tsconfig.json`:

```typescript
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.injectionjs/metadata" />
```

Use one doubles adapter reference and one DI adapter reference per test TypeScript project. These declarations load module augmentations directly; no postinstall script is needed.

For Vitest, use `@suites/doubles.vitest/unit` for the first reference.

Enable decorator metadata in your test TypeScript configuration:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Load `reflect-metadata` before decorated classes. Your Jest or Vitest transformer must also emit decorator metadata; follow the [runner setup](https://suites.dev/docs/get-started/installation/).

For Vitest, also externalize InjectionJS so the test and adapter share decorator and token identity. Add this to your existing Vitest configuration, keeping your decorator metadata transformer:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: { deps: { external: ['injection-js'] } },
  },
});
```

## Write a test

Create `user.service.ts`:

```typescript
import 'reflect-metadata';
import { Injectable } from 'injection-js';

export abstract class UserRepository {
  abstract findName(id: string): Promise<string>;
}

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  findName(id: string): Promise<string> {
    return this.users.findName(id);
  }
}
```

Create `user.service.test.ts`:

```typescript
import { expect, it } from '@jest/globals';
import { TestBed } from '@suites/unit';
import { UserRepository, UserService } from './user.service.js';

it('returns the repository result', async () => {
  const { unit, unitRef } = await TestBed.solitary(UserService).compile();
  const users = unitRef.get(UserRepository);
  users.findName.mockResolvedValue('Alice');

  await expect(unit.findName('1')).resolves.toBe('Alice');
  expect(users.findName).toHaveBeenCalledWith('1');
});
```

For Vitest, import `expect` and `it` from `vitest`. The repository is automatically mocked, and the abstract class token preserves type inference.

## Supported dependency patterns

- Class dependencies discovered through constructor decorator metadata.
- `@Inject()` with a concrete or abstract class, nonempty string, symbol, or `InjectionToken`.
- `forwardRef()` constructor tokens resolved to their underlying token.
- Static `parameters` and lowered `ctorParameters` metadata supported by InjectionJS.

For interfaces, declare an `InjectionToken` and use an explicit dependency type in overrides and lookups:

```typescript
import { InjectionToken } from 'injection-js';

export const USER_REPOSITORY = new InjectionToken<UserRepository>('UserRepository');
```

Inject it with `@Inject(USER_REPOSITORY)` in your constructor, then retrieve the mock with `unitRef.get<UserRepository>(USER_REPOSITORY)`. Tokens are compared by identity: two tokens with the same description remain distinct.

## Scope and limitations

This adapter supports constructor injection. Contextual `inject()` calls, including class field initializers, are unsupported in the class under test and real dependencies exposed in sociable tests.

Suites builds a flat test container. `@Optional()`, `@Self()`, `@SkipSelf()`, and `@Host()` do not reproduce production injector lookup rules. Optional dependencies are mocked like other constructor dependencies; use `.mock<Dependency | null>(token).final(null)` to test an absent dependency.

Suites does not consume provider configuration, run provider factories, collect multi-providers, or resolve injector hierarchies. Arbitrary object, numeric, and boolean tokens are unsupported; use `InjectionToken` for object identity.

The examples use `.js` import paths for TypeScript ESM compatibility. When Jest transforms TypeScript source directly, configure its [relative import mapping](https://github.com/suites-dev/unit/tree/master/packages/doubles/jest#typescript-import-paths).

## Next steps

- [Configure mocks and final values](https://suites.dev/docs/api-reference/mock-configuration/)
- [Keep selected dependencies real](https://suites.dev/docs/guides/sociable/)
- [Configure the test runner](https://suites.dev/docs/get-started/installation/)

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
