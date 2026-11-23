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

Use `TestBed.sociable(UserService).expose(Repository, ConcreteDependency).compile()` to keep selected class dependencies real. Exposure is variadic. Undeclared sociable dependencies are injected as guards: leaving one unused is valid, while accessing one records a rule violation and throws. Declare intentional replacements with `.mock(identifier).impl()` or `.final()`, and configure the Jest environment or Vitest setup file once so caught violations still fail the file or suite. The class under test and exposed classes must be concrete constructors; abstract classes can be used as dependency tokens in `.mock()` and `unitRef.get()`.

V5 composition is explicitly opt in:

```typescript
const { unit } = await TestBed.sociable(UserService).compose().compile();
```

Map a requested injection token to a real implementation with `.bind()`:

```typescript
const USER_REPOSITORY = Symbol('USER_REPOSITORY');

const selective = await TestBed.sociable(UserService)
  .bind<UserRepository>(USER_REPOSITORY, SqlUserRepository)
  .expose(DatabaseConnection)
  .compile();

const composed = await TestBed.sociable(UserService)
  .compose()
  .bind<UserRepository>(USER_REPOSITORY, SqlUserRepository)
  .compile();
```

Bindings work before or after choosing selective exposure or composition. A direct `TestBed.sociable(UserService).bind(TOKEN, Implementation).compile()` constructs the bound implementation while retaining ordinary selective treatment for its dependencies. Composition follows the implementation recursively. Suites uses the requested token as the dependency identity; separate tokens that use one implementation remain separate, while repeated occurrences of one token and metadata qualifier share an instance. Explicit mock or final overrides take precedence, and contradictory bindings for one token fail compilation.

Abstract and concrete class tokens encode their instance type, so `.bind(ClassToken, Implementation)` checks compatibility. Plain string and symbol tokens do not encode a value type; use `.bind<Contract>(TOKEN, Implementation)` when that check is required. A binding describes test wiring only and does not inspect or verify the application's production container registration.

Selective exposure and recursive composition are mutually exclusive choices: neither `.expose(...).compose()` nor `.compose().expose(...)` is available. `.bind()` does not combine those modes and two-argument `.expose(TOKEN, Implementation)` is unsupported. Composition recursively constructs a class only when the selected DI adapter positively identifies it as constructable by that framework. Suites does not infer constructibility from a function token or implemented prototype members. Unmarked classes, including ambiguous concrete leaves, remain unresolved in composed mode until a token-to-implementation binding or explicit boundary is supplied. TypeScript erases the `abstract` modifier, so a framework decorator applied directly to an abstract class can still make it indistinguishable from a concrete class at runtime. Forbidden boundaries are delivered separately.

See [solitary tests](https://suites.dev/docs/guides/solitary/), [sociable tests](https://suites.dev/docs/guides/sociable/), and [mock configuration](https://suites.dev/docs/api-reference/mock-configuration/).

## Migration

### Upgrade sociable builder extensions to V5

`TestBed.sociable()` now returns the full initial sociable builder. Choose selective mode with `.expose(first, ...rest)` or composed mode with `.compose()`; the modes are mutually exclusive and cannot be chained together.

Custom `TestBed` subclasses must no longer narrow `sociable()` to an expose-only `Pick`. Return the full initial builder instead:

```typescript
import { TestBed, type SociableTestBedBuilder } from '@suites/unit';
import type { Type } from '@suites/types.common';

class CustomTestBed extends TestBed {
  static override sociable<T>(target: Type<T>): SociableTestBedBuilder<T> {
    return super.sociable(target);
  }
}
```

Helpers that accept a builder before its mode is chosen should also use `SociableTestBedBuilder<T>`. After `.expose(...)` or `.compose()`, let TypeScript retain the inferred mode-specific return type instead of annotating it as the initial builder. Upgrade `@suites/unit`, `@suites/core.unit`, and the selected doubles adapter to the same major version.

- [Upgrade from Suites 3 to 4](https://github.com/suites-dev/unit/blob/master/docs/migration-v4.md)
- [Migrate from Automock](https://suites.dev/docs/migration-guides/from-automock/)

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
