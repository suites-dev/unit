<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/di.nestjs</h1>

<p align="center">
NestJS dependency injection adapter for Suites
</p>

<p align="center">
  <a href="https://docs.nestjs.com/v11/recipes/suites">Suites in the official NestJS documentation</a>
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/di.nestjs"><img src="https://img.shields.io/npm/dm/@suites/di.nestjs.svg?label=%40suites%2Fdi.nestjs" alt="npm downloads" /></a>
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

Test NestJS services with Suites. The adapter reads dependency metadata so `TestBed` can supply typed mocks without creating your production container.

## Installation

For Jest:

```sh
pnpm add -D @suites/unit @suites/di.nestjs @suites/doubles.jest
```

For Vitest:

```sh
pnpm add -D @suites/unit @suites/di.nestjs @suites/doubles.vitest
```

Your application must also have `@nestjs/common` and `reflect-metadata` installed. Supported NestJS versions: `^10.0.0 || ^11.0.0 || ^12.0.1`.

Suites 4 supports Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, with CommonJS and ESM package entry points.

## Configuration

Create `suites.d.ts` and include it in your test `tsconfig.json`:

```typescript
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
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

## Write a test

Create `user.service.ts`:

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

For Vitest, import `expect` and `it` from `vitest`. The repository is automatically mocked, and the abstract class token preserves type inference.

## Supported dependency patterns

- Constructor dependencies discovered through NestJS decorator metadata.
- `@Inject()` on constructor parameters and properties, including string and symbol tokens.
- `forwardRef()` tokens resolved to the underlying class or identifier.
- Abstract class tokens in `.mock()` and `unitRef.get()`.

For a custom token, use an explicit dependency type: `unitRef.get<UserRepository>('USER_REPOSITORY')`. The `/metadata` reference rejects identifier metadata arguments, which NestJS does not use.

Suites builds a flat test container from the class. It does not load NestJS modules, run application lifecycle hooks, or reproduce production provider factories, scopes, and multi-provider configuration. Supply values with `.mock(token).final(value)` when needed.

The examples use `.js` import paths for TypeScript ESM compatibility. When Jest transforms TypeScript source directly, configure its [relative import mapping](https://github.com/suites-dev/unit/tree/master/packages/doubles/jest#typescript-import-paths).

## Next steps

- [Configure mocks and final values](https://suites.dev/docs/api-reference/mock-configuration/)
- [Keep selected dependencies real](https://suites.dev/docs/guides/sociable/)
- [Configure the test runner](https://suites.dev/docs/get-started/installation/)

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
