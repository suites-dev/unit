<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/doubles.vitest</h1>

<p align="center">
Vitest test doubles adapter for Suites
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/doubles.vitest"><img src="https://img.shields.io/npm/dm/@suites/doubles.vitest.svg?label=%40suites%2Fdoubles.vitest" alt="npm downloads" /></a>
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

Generate typed dependency mocks backed by Vitest's mock functions. Configure responses with `mockReturnValue`, `mockResolvedValue`, and `mockImplementation`, then verify calls with your runner's assertions.

## Installation

For NestJS with Vitest:

```sh
pnpm add -D @suites/unit @suites/di.nestjs @suites/doubles.vitest
```

Replace `@suites/di.nestjs` with `@suites/di.inversify` or `@suites/di.injectionjs` for your DI framework. Install one doubles adapter per test project.

Declares `vitest` and `@vitest/spy` peer dependencies at `>=1.0`. Use matching versions of those two packages. Suites 4 supports Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, with CommonJS and ESM package entry points.

## Configuration

Create `suites.d.ts` and include it in your test `tsconfig.json`:

```typescript
/// <reference types="@suites/doubles.vitest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
```

Use one doubles adapter reference and one DI adapter reference per test TypeScript project. These declarations load module augmentations directly; no postinstall script is needed.

For Inversify or InjectionJS, replace the DI reference with `@suites/di.inversify/metadata` or `@suites/di.injectionjs/metadata`. Load `reflect-metadata` and configure your transformer to emit decorator metadata using the [installation guide](https://suites.dev/docs/get-started/installation/). InjectionJS with Vitest also requires externalizing `injection-js`; see its [adapter README](https://github.com/suites-dev/unit/tree/master/packages/di/injection-js#readme).

## Write a test

Given a decorated `UserService` that injects `UserRepository`, as in the [NestJS example](https://github.com/suites-dev/unit/tree/master/packages/di/nestjs#write-a-test):

```typescript
import { expect, it } from 'vitest';
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

`unitRef.get()` infers mocks from concrete or abstract class tokens. For string, symbol, and InjectionJS `InjectionToken` identifiers, pass the dependency type explicitly.

## Standalone mocks

Use `mock<T>()` for an object and `stub()` for a callback:

```typescript
import { expect, it } from 'vitest';
import { mock, stub } from '@suites/doubles.vitest';

interface UserRepository {
  findName(id: string): Promise<string>;
}

it('creates standalone doubles', async () => {
  const users = mock<UserRepository>();
  users.findName.mockResolvedValue('Alice');

  const callback = stub();
  callback.mockReturnValue('saved');

  await expect(users.findName('1')).resolves.toBe('Alice');
  expect(callback()).toBe('saved');
  expect(callback).toHaveBeenCalledTimes(1);
});
```

Import `Mocked<T>` and `Stub` from `@suites/unit` when declaring your test variables. The `/unit` declaration reference supplies the Vitest mock APIs to those types. Create a fresh test bed per test to keep mock state isolated.

The examples use `.js` import paths for TypeScript ESM compatibility. When Jest transforms TypeScript source directly, configure its [relative import mapping](https://github.com/suites-dev/unit/tree/master/packages/doubles/jest#typescript-import-paths).

## Next steps

- [Configure mock implementations](https://suites.dev/docs/api-reference/mock-configuration/)
- [Installation and runner configuration](https://suites.dev/docs/get-started/installation/)

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
