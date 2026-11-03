<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/suites/master/logo.png" alt="Logo" />
</p>

<h1 align="center">Suites (Unit)</h1>

<p align="center">
A unit testing framework for TypeScript backends working with inversion of control and dependency injection
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/suites/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" /></a>
  <a href="https://npmjs.org/package/@suites/unit"><img src="https://img.shields.io/npm/dm/@suites/unit.svg?label=%40suites%2Funit" alt="npm downloads" /></a>
</div>

<h3 align="center">
  <a href="https://suites.dev">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://suites.dev/docs/get-started/quickstart">Getting Started</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://suites.dev/docs/get-started/why-suites">Why Suites</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://suites.dev/docs/guides">Guides</a>
</h3>

<p align="center">
Using Suites? <a href="https://github.com/suites-dev/suites/discussions/655">Share your experience</a>, and help us shape the future of Suites
</p>

## Features

- **Declarative** - Provides a declarative API for defining fully-typed, isolated test environments from a single specification, including automatic mock generation and dependency wiring based on constructor metadata.

- **Type-Safe Refactoring** - Binds mocks to concrete TypeScript implementations so that changes to constructors, injected dependencies, and method signatures are validated at compile time, enabling confident refactors with less failing tests.

- **Standardized Testing Across Teams** - Exposes a uniform testing surface across NestJS, InversifyJS, and other DI setups, enabling consistent test structure and patterns regardless of the underlying framework.

- **AI Ready** - Provides a concise and strict test API that minimizes context requirements for LLM-based coding agents, enabling higher-quality generated tests, clearer and more actionable error messages that guide automatic self-correction, and a higher likelihood of completing test authoring in a single pass.

## Examples

### Solitary Mode

**Solitary mode** tests a single unit in complete isolation - all dependencies are automatically mocked. Use this when
you want to test your unit's logic without any real dependencies.

[Learn more about Solitary Tests](https://suites.dev/docs/guides/solitary)

```typescript
import { TestBed, type Mocked } from '@suites/unit';

describe('User Service', () => {
  let userService: UserService; // Class under test
  let userApi: Mocked<UserApi>; // Mock instance
  let database: Mocked<Database>; // Mock instance

  beforeAll(async () => {
    // Create the test environment with automatic mocking
    const testBed = await TestBed.solitary(UserService).compile();

    userService = testBed.unit;
    // Retrieve the mock instances
    userApi = testBed.unitRef.get(UserApi);
    database = testBed.unitRef.get(Database);
  });

  it('should generate a random user and save to the database', async () => {
    const mockUser = { id: 1, name: 'John' } as User;
    userApi.getRandom.mockResolvedValue(mockUser);

    await userService.generateRandomUser();

    expect(database.saveUser).toHaveBeenCalledWith(mockUser);
  });
}
```

### How It Works

The test setup uses `TestBed.solitary()` to create an isolated testing environment:

1. **TestBed analyzes the class** - Reads `UserService` constructor to find `UserApi` and `Database` dependencies
2. **Automatic mocks are created** - Generates mock instances of `UserApi` and `Database` with all methods as stubs
3. **Dependencies are injected** - Wires the mocks into `UserService` constructor automatically
4. **Type-safe access** - Use `unitRef.get()` to retrieve mocks with full TypeScript support

No manual mock creation needed. `TestBed` handles dependency discovery, mock generation, and wiring automatically.

### Automatic Mocking of Dependencies

When using `TestBed.solitary()`, all dependencies are automatically mocked. Each method becomes a stub with no predefined responses. Configure stub responses in tests as needed.

```typescript
// These stubs start with no return values
userApi.getRandom; // Returns undefined by default
database.saveUser; // Returns undefined by default

// Configure them in your tests
userApi.getRandom.mockResolvedValue({ id: 1, name: 'John' });
database.saveUser.mockResolvedValue(42);
```

### Sociable Mode

**Sociable mode** tests how components work together. You choose which dependencies to keep real (using `.expose()`) while external I/O remains mocked. Use this when you want to test integration between multiple units.

[Learn more about Sociable Tests](https://suites.dev/docs/guides/sociable)

```typescript
import { TestBed, type Mocked } from '@suites/unit';

describe('User Service', () => {
  let userService: UserService; // Class under test
  let database: Mocked<Database>; // Mock instance

  beforeAll(async () => {
    // Create test environment with real UserApi
    const testBed = await TestBed.sociable(UserService)
      .expose(UserApi) // Use real UserApi implementation
      .compile();

    userService = testBed.unit;
    database = testBed.unitRef.get(Database);
  });

  it('should generate a random user and save to the database', async () => {
    await userService.generateRandomUser();

    expect(database.saveUser).toHaveBeenCalled();
  });
}
```

## Prerequisites

Before installing Suites, ensure your project meets these requirements:

- **Node.js**: 22.22.2+, 24.15.0+, or 26.x. Node 16, 18, 20, and odd-numbered releases are not supported by Suites 4.

- **Dependency Injection Framework**: NestJS, InversifyJS, or plain TypeScript classes with constructor injection
- **Testing Library**: Jest or Vitest

Supported DI framework versions:

| Framework | Version range                       |
| --------- | ----------------------------------- |
| NestJS    | `^10.0.0 \|\| ^11.0.0 \|\| ^12.0.1` |
| Inversify | `^7.0.0 \|\| ^8.0.0`                |

CI tests the minimum and current releases of each supported major on Node 22, 24, and 26.

Suites 3.x releases retain their existing Node support. See [Upgrading to Suites 4](docs/migration-v4.md) before upgrading.

## Installation

First, install Suites' unit package:

```bash
npm i -D @suites/unit
# or
pnpm add -D @suites/unit
# or
pnpm add -D @suites/unit
```

Then, install **ONE** adapter for your DI framework and **ONE** adapter for your testing library:

**DI Framework Adapters:**

- **NestJS** - `@suites/di.nestjs`
- **InversifyJS** - `@suites/di.inversify`

**Testing Library Adapters:**

- **Jest** - `@suites/doubles.jest`
- **Vitest** - `@suites/doubles.vitest`

**Example for NestJS + Jest:**

```bash
npm i -D @suites/doubles.jest @suites/di.nestjs
# or
pnpm add -D @suites/doubles.jest @suites/di.nestjs
# or
pnpm add -D @suites/doubles.jest @suites/di.nestjs
```

> **Note:** If you're using NestJS or Inversify, you'll also need to install `reflect-metadata` as a runtime dependency (not a dev dependency):
>
> ```bash
> npm i reflect-metadata
> ```

For complete installation instructions, see the [Installation Guide](https://suites.dev/docs/get-started/installation).

## Configuration

### Type Definitions

Create a `suites.d.ts` file included by your test `tsconfig.json`:

```typescript
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
```

Use `@suites/doubles.vitest/unit` for Vitest or `@suites/di.inversify/metadata` for Inversify. Include one test-double adapter and one DI adapter per test TypeScript project.

The `/unit` reference supplies mock types and methods. The `/metadata` reference enforces the DI adapter's metadata rules: NestJS has no identifier metadata; Inversify supports named and tagged bindings. These are packaged type declarations, so no postinstall script or edits to `node_modules` are required.

For detailed configuration instructions, see the [Installation Guide](https://suites.dev/docs/get-started/installation).

### Contributing

We welcome contributions to Suites! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Share Your Suites Experience!

**Are you using Suites in your projects?** We've created a [community discussion](https://github.com/suites-dev/suites/discussions/categories/q-a) where teams and companies can share how they're using Suites in production.

👉 **[Join the discussion](https://github.com/suites-dev/suites/discussions/categories/q-a)** and tell us more :)

Your contributions help others discover best practices and see real-world applications of Suites!

## Migrating from Automock

If you're currently using Automock, we've created a comprehensive migration guide to help you transition to Suites. The
guide covers all the changes and improvements, making the upgrade process smooth and straightforward.

[↗️ Migrating from Automock Guide](https://suites.dev/docs/migration-guides/from-automock)

## License

Suites is licensed under the [Apache License, Version 2.0](LICENSE).
