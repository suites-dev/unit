<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/types.di</h1>

<p align="center">
Dependency injection adapter contracts for Suites
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/types.di"><img src="https://img.shields.io/npm/dm/@suites/types.di.svg?label=%40suites%2Ftypes.di" alt="npm downloads" /></a>
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

Shared contracts between Suites core and DI adapters. Application tests select `@suites/di.nestjs`, `@suites/di.inversify`, or `@suites/di.injectionjs`; custom adapter authors use this package directly.

## Adapter contracts

- `DependencyInjectionAdapter` inspects a concrete class and returns its dependency registry.
- `InjectableRegistry` lists and resolves constructor and property dependencies.
- `InjectableIdentifier<T>` accepts abstract or concrete class tokens, strings, symbols, and adapter-registered identifiers.
- `IdentifierMetadata` derives the selected adapter's metadata rules from declaration augmentation.

## Load adapter declarations

Create `suites.d.ts` in your test TypeScript project. For NestJS with Jest:

```typescript
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
```

The NestJS and InjectionJS references reject identifier metadata arguments. Inversify's reference enables named and tagged metadata. InjectionJS's reference also registers `InjectionToken` identifiers. Load one DI adapter reference per test TypeScript project.

## Extend the contracts

Custom DI adapters can augment `IdentifierMetadataRegistry` with their metadata type and `InjectableIdentifierRegistry<T>` with additional runtime token types. Publish those augmentations through the adapter's `/metadata` declaration entry point and ensure its runtime preserves token identity.

Without an adapter reference, metadata retains a generic fallback for building the shared runtime. Consumer tests should include the selected adapter's declaration reference to enforce its rules.

See [DI adapter contracts](https://github.com/suites-dev/unit/tree/master/packages/types/di#readme) and the [installation guide](https://suites.dev/docs/get-started/installation/).

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
