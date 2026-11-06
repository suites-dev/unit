<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/types.doubles</h1>

<p align="center">
Test doubles adapter contracts for Suites
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/types.doubles"><img src="https://img.shields.io/npm/dm/@suites/types.doubles.svg?label=%40suites%2Ftypes.doubles" alt="npm downloads" /></a>
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

Shared types connecting Suites to test doubles libraries. Jest and Vitest adapters provide the mock implementation and augment these contracts with their runner's mock APIs.

## Application tests

Import the public mock types from `@suites/unit`:

```typescript
import type { Mocked, Stub } from '@suites/unit';
```

Include your doubles adapter's declaration entry point in `suites.d.ts`, alongside your DI adapter. For Jest with NestJS:

```typescript
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
```

For Vitest, use `@suites/doubles.vitest/unit`. Use the metadata reference for your selected DI framework. These references provide runner-specific methods such as `mockResolvedValue` on `Mocked<T>` and `Stub`.

## Adapter development

- `DoublesAdapter` supplies `mock` and `stub` functions to Suites core.
- `MockFunction` creates mocked instances from optional partial implementations.
- `Stub<ReturnType, Args>` describes a callable function before runner augmentation.
- `StubbedInstance<T>` and `StubbedMember<T>` support the internal mapping of members to doubles.

Use `Mocked<T>` from `@suites/unit` in application tests so the public adapter augmentation applies. This package contains declarations and has no runtime adapter implementation.

See [DI adapter contracts](https://github.com/suites-dev/unit/tree/master/packages/types/di#readme) and [mock configuration](https://suites.dev/docs/api-reference/mock-configuration/).

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
