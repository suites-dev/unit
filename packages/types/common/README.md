<p align="center">
  <img width="90" src="https://raw.githubusercontent.com/suites-dev/unit/master/logo.png" alt="Suites logo" />
</p>

<h1 align="center">@suites/types.common</h1>

<p align="center">
Shared constructor and value types for Suites
</p>

<div align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="license" /></a>
  <a href="https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.npmjs.com/package/@suites/types.common"><img src="https://img.shields.io/npm/dm/@suites/types.common.svg?label=%40suites%2Ftypes.common" alt="npm downloads" /></a>
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

Shared TypeScript types used by Suites core and adapters. Application tests usually import `TestBed`, `Mocked<T>`, and `Stub` from `@suites/unit`; this package is useful when authoring integrations.

## Constructor types

```typescript
import type { AbstractType, Type } from '@suites/types.common';

abstract class Repository {
  abstract findName(id: string): Promise<string>;
}

class MemoryRepository extends Repository {
  async findName(id: string): Promise<string> {
    return id;
  }
}

const token: AbstractType<Repository> = Repository;
const implementation: Type<Repository> = MemoryRepository;
const repository = new implementation();
```

`AbstractType<T>` accepts abstract or concrete class tokens. `Type<T>` represents a concrete constructor that can be called with `new`. Use abstract tokens in `.mock()` and `unitRef.get()`; pass concrete classes to `TestBed.solitary()`, `TestBed.sociable()`, and `.expose()`.

## Other shared types

- `DeepPartial<T>` describes recursively optional object members.
- `ConstantValue` describes supported primitive and array values, including `null`.
- `FinalValue<T>` describes values accepted as supplied dependency implementations.

This package provides types rather than a mocking or dependency injection runtime. It is installed transitively by Suites; integration authors importing it directly should declare it as a dependency.

See the [unit API](https://github.com/suites-dev/unit/tree/master/packages/unit#readme) for application examples.

## Community and contributing

Ask questions in [GitHub Discussions](https://github.com/suites-dev/unit/discussions), [report an issue](https://github.com/suites-dev/unit/issues), or read the [contribution guidelines](https://github.com/suites-dev/unit/blob/master/CONTRIBUTING.md).

## License

Suites is licensed under the [Apache License, Version 2.0](https://github.com/suites-dev/unit/blob/master/LICENSE).
