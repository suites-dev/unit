<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/unit</h1>

<p align="center">
A unit testing framework for TypeScript backends working with inversion of control and dependency injection
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/unit"><img src="https://img.shields.io/npm/dm/@suites/unit.svg?label=%40suites%2Funit" alt="npm downloads" /></a>
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

Suites discovers injected dependencies, creates typed mocks, and wires them into your class under test. Use the same `TestBed` API with NestJS, Inversify, or InjectionJS and Jest or Vitest.

## Installation

Install the unit package, one DI adapter, and one doubles adapter. For NestJS with Jest:

```sh
pnpm add -D @suites/unit @suites/di.nestjs @suites/doubles.jest
```

Use `@suites/di.inversify` or `@suites/di.injectionjs` for your DI framework, and `@suites/doubles.vitest` for Vitest. Your application must also have its DI framework and `reflect-metadata` installed.

Suites 4 supports Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, with CommonJS and ESM package entry points.

| Adapter                  | Supported framework versions        |
| ------------------------ | ----------------------------------- |
| `@suites/di.nestjs`      | `^10.0.0 \|\| ^11.0.0 \|\| ^12.0.1` |
| `@suites/di.inversify`   | `^7.0.0 \|\| ^8.0.0`                |
| `@suites/di.injectionjs` | `^2.6.1`, constructor injection     |

Jest requires `jest` and `@jest/globals` in `^30.5.2`. The Vitest adapter declares `vitest` and `@vitest/spy` peers at `>=1.0`; use matching versions of those two packages.

## Configuration

Create `suites.d.ts` and include it in your test `tsconfig.json`:

```typescript
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
```

Use one doubles adapter reference and one DI adapter reference per test TypeScript project. These declarations load module augmentations directly; no postinstall script is needed.

For Vitest, replace the first reference with `@suites/doubles.vitest/unit`. For Inversify or InjectionJS, replace the second with `@suites/di.inversify/metadata` or `@suites/di.injectionjs/metadata`.

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

## Solitary tests

Create `user.service.ts` (NestJS shown):

```typescript
import 'reflect-metadata';
import { Injectable } from '@nestjs/common';

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

Each test gets a fresh unit and repository mock. For Vitest, import `expect` and `it` from `vitest`. `unitRef.get(UserRepository)` infers the typed mock from the abstract class token.

The examples use `.js` import paths for TypeScript ESM compatibility. When Jest transforms TypeScript source directly, configure its [relative import mapping](https://github.com/suites-dev/unit/tree/master/packages/doubles/jest#typescript-import-paths).

## Configure dependencies

Use `.impl()` to configure a generated mock, or `.final()` to inject a supplied value:

```typescript
const { unit, unitRef } = await TestBed.solitary(UserService)
  .mock(UserRepository)
  .impl((stub) => ({ findName: stub().mockResolvedValue('Alice') }))
  .compile();

const users = unitRef.get(UserRepository);
users.findName.mockResolvedValue('Bob');

const { unit: unitWithFake } = await TestBed.solitary(UserService)
  .mock(UserRepository)
  .final({ findName: async () => 'Alice' })
  .compile();
```

A `.final()` dependency is injected as supplied and cannot be retrieved through `unitRef.get()`. It does not freeze the value. String, symbol, and InjectionJS `InjectionToken` identifiers require an explicit dependency type, such as `unitRef.get<UserRepository>(USER_REPOSITORY)`.

## Sociable tests

Use `TestBed.sociable(UserService).expose(ConcreteDependency).compile()` to keep selected class dependencies real and mock their remaining dependencies. The class under test and exposed classes must be concrete constructors; abstract classes can be used as dependency tokens in `.mock()` and `unitRef.get()`.

See [solitary tests](https://suites.dev/docs/guides/solitary/), [sociable tests](https://suites.dev/docs/guides/sociable/), and [mock configuration](https://suites.dev/docs/api-reference/mock-configuration/).

## Migration

- [Upgrade from Suites 3 to 4](https://github.com/suites-dev/unit/blob/master/docs/migration-v4.md)
- [Migrate from Automock](https://suites.dev/docs/migration-guides/from-automock/)

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
