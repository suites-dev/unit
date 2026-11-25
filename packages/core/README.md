<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/core.unit</h1>

<p align="center">
Dependency resolution and test bed builders for Suites
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/core.unit"><img src="https://img.shields.io/npm/dm/@suites/core.unit.svg?label=%40suites%2Fcore.unit" alt="npm downloads" /></a>
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

The core package powers dependency discovery, mock overrides, solitary and sociable builders, and dependency lookups. `@suites/unit` uses it internally with the selected DI and doubles adapters.

## Application tests

Install and import `@suites/unit` for the public testing API:

```sh
pnpm add -D @suites/unit @suites/di.nestjs @suites/doubles.jest
```

```typescript
import { TestBed } from '@suites/unit';
```

Follow the [unit package README](https://github.com/suites-dev/unit/tree/master/packages/unit#readme) for a complete test and declaration setup. Suites 4 supports Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, with CommonJS and ESM package entry points.

## Package responsibilities

- Builds isolated tests with automatically mocked dependencies.
- Keeps selected concrete dependencies real in sociable tests.
- Resolves class, string, symbol, and adapter-registered identifiers.
- Applies `.impl()` mock implementations and `.final()` supplied values.
- Preserves identifier identity and adapter metadata during lookups.

Abstract classes are accepted as dependency tokens. The class under test and exposed dependencies must be concrete because Suites instantiates them.

## Adapter development

DI adapters implement contracts from `@suites/types.di`; doubles adapters implement contracts from `@suites/types.doubles`. Use `@suites/types.common` for shared constructor types. Read the [DI adapter contracts](https://github.com/suites-dev/unit/tree/master/packages/types/di#readme) before building an integration.

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
