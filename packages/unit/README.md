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

Suites supports Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, with CommonJS and ESM package entry points.

| Adapter                  | Supported framework versions        |
| ------------------------ | ----------------------------------- |
| `@suites/di.nestjs`      | `^10.0.0 \|\| ^11.0.0 \|\| ^12.0.1` |
| `@suites/di.inversify`   | `^7.0.0 \|\| ^8.0.0`                |
| `@suites/di.injectionjs` | `^2.6.1`, constructor injection     |

Jest requires `jest` and `@jest/globals` in `^30.5.2`. The Vitest adapter declares `vitest` and `@vitest/spy` peers at `>=1.0`; use matching versions of those two packages.

## Configuration

Create `suites.d.ts` and include it in your test `tsconfig.json`:

```typescript
/// <reference types="@suites/doubles.jest/metadata" />
/// <reference types="@suites/di.nestjs/metadata" />
```

Use one doubles adapter reference and one DI adapter reference per test TypeScript project. These declarations load module augmentations directly; no postinstall script is needed.

For Vitest, replace the first reference with `@suites/doubles.vitest/metadata`. For Inversify or InjectionJS, replace the second with `@suites/di.inversify/metadata` or `@suites/di.injectionjs/metadata`.

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

In v5, choose the real collaborators before configuring replacements. Replace v4's `.expose(A).expose(B)` with one `.expose(A, B)` call. Declare each collaborator your code uses that should be mocked. For example, this test keeps pricing real and gives inventory a controlled response.

```typescript
const { unit } = await TestBed.sociable(Checkout)
  .expose(Pricing)
  .mock(Inventory)
  .impl((stub) => ({ available: stub().mockReturnValue(true) }))
  .compile();
```

An undeclared dependency can be injected and left unused. Reading or calling it records a dependency violation and throws immediately. Configure your runner once so a caught violation also fails the run.

| Runner | Install alongside the doubles adapter | Project configuration |
| --- | --- | --- |
| Jest 30.5.2 or later in v30 | `pnpm add -D @suites/runners.jest` | Set `testEnvironment` to `'@suites/runners.jest/environment'`. |
| Vitest 5.1 or later in v5 | `pnpm add -D @suites/runners.vitest` | Add `'@suites/runners.vitest/setup'` to `test.setupFiles`. |

For a custom Jest environment, export `withDependencyVerification(ExistingEnvironment)` from your environment module using the helper in `@suites/runners.jest/environment`. Jest Circus and Vitest can report a caught assertion as passed while marking its suite failed and exiting with status 1.

Choose one mode before configuring or compiling a sociable test. Replace repeated calls such as `.expose(A).expose(B)` with `.expose(A, B)`. Use `.compose()` to construct the injectable graph recursively:

```typescript
const { unit } = await TestBed.sociable(UserService).compose().compile();
```

Map a requested injection token to a real implementation with `.bind()`:

```typescript
const USER_REPOSITORY = Symbol('USER_REPOSITORY');

const selective = await TestBed.sociable(UserService)
  .expose(DatabaseConnection)
  .bind<UserRepository>(USER_REPOSITORY, SqlUserRepository)
  .compile();

const composed = await TestBed.sociable(UserService)
  .compose()
  .bind<UserRepository>(USER_REPOSITORY, SqlUserRepository)
  .compile();
```

Selective exposure constructs the bound implementation and the classes passed to `.expose()`. Composition follows its injectable dependencies recursively. Each token and qualifier pair receives its own instance, so two tokens bound to the same implementation remain distinct. For adapters with qualifiers, a qualified mock or final value replaces only the matching request. Other requests use the bound implementation. Combining a binding with an unqualified mock or final value for that token makes `.compile()` reject before construction. Binding the token to two different implementations also fails.

Class tokens check the implementation's instance type. Use `.bind<Contract>(TOKEN, Implementation)` for string, symbol, and InjectionJS tokens when you want TypeScript to check the implementation against a specific contract. Third-party adapters can register additional token types through their type declarations.

Composition constructs a class when the DI adapter identifies it as constructable. For an unmarked class or an abstract token, select a real implementation with `.bind()` or configure a mock. TypeScript erases the abstract modifier, so a framework decorator on an abstract class can make it indistinguishable from a concrete class at runtime.

### Forbidding a dependency in a composed test

A checkout preview can calculate a total without contacting the payment gateway. Pass the gateway's injection identifier to `.forbid()` to enforce that boundary:

```typescript
const { unit } = await TestBed.sociable(CheckoutService)
  .compose()
  .forbid(PAYMENT_GATEWAY)
  .compile();

expect(unit.preview(cart).total).toBe(25);
```

Suites stops construction at `PAYMENT_GATEWAY` and injects a guard. Receiving the guard is safe. Reading a member or calling the guard throws an error with the dependency path. With the Suites Jest environment or Vitest setup file configured, the file fails even when the application catches that error and returns a fallback.

Pass several identifiers to `.forbid(PAYMENT_GATEWAY, EmailSender)` to stop at each one. A forbidden identifier covers all of its metadata qualifiers. Declaring a mock or binding for that same identifier makes `.compile()` reject the conflicting setup.

See [solitary tests](https://suites.dev/docs/guides/solitary/), [sociable tests](https://suites.dev/docs/guides/sociable/), and [mock configuration](https://suites.dev/docs/api-reference/mock-configuration/).

## Migration

- [Upgrade from Suites 3 to 4](https://github.com/suites-dev/unit/blob/master/docs/migration-v4.md)
- [Migrate from Automock](https://suites.dev/docs/migration-guides/from-automock/)

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
