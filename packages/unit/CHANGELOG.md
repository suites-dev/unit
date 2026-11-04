# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Funit%403.1.1...%40suites%2Funit%404.0.0) (2026-11-04)

### Bug Fixes

* **security:** harden release preview and update vulnerable tooling [skip ci] ([#1084](https://github.com/suites-dev/unit/issues/1084)) ([d7b287f](https://github.com/suites-dev/unit/commit/d7b287f080ea4ed11372865e738798c09e5c37f5))

### Features

* **unit:** move TestBed to Suites 4 and retire Sinon ([faa4c4c](https://github.com/suites-dev/unit/commit/faa4c4c484680a69f45f980a6efe143716d831b6))

### BREAKING CHANGES

* **unit:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.
  In a `suites.d.ts` file included by your test tsconfig, add `/// <reference types="@suites/doubles.jest/unit" />` or `/// <reference types="@suites/doubles.vitest/unit" />` for your test-double adapter. Also add `/// <reference types="@suites/di.nestjs/metadata" />` or `/// <reference types="@suites/di.inversify/metadata" />` for your DI adapter. Include one `/unit` reference and one `/metadata` reference per test TypeScript project; installation no longer configures these types. The NestJS reference rejects metadata arguments in `mock()` and `get()`; Inversify accepts named and tagged metadata objects.
  Sinon support is removed. The unmaintained `@suites/doubles.sinon` adapter is no longer discovered and will not receive a version 4 release. Remove it and migrate your tests, stub calls, assertions, and type references to `@suites/doubles.jest` or `@suites/doubles.vitest`.


## [3.1.1](https://github.com/suites-dev/suites/compare/@suites/unit@3.1.0...@suites/unit@3.1.1) (2026-05-06)

### Bug Fixes

- **unit:** remove direct Mocked and Stub exports to fix TS2300 ([#1020](https://github.com/suites-dev/suites/issues/1020)) ([0367eb4](https://github.com/suites-dev/suites/commit/0367eb4b12bb9b3d601db35abf715e57edd05c02))

# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/unit@3.0.1...@suites/unit@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **unit:** add dual CJS/ESM build with ESM package resolver ([ef707cf](https://github.com/suites-dev/suites/commit/ef707cf0b4f5f695ca8d3b9b8b7a66351614191b))
- **unit:** export base type abstractions ([e2e5993](https://github.com/suites-dev/suites/commit/e2e59937c551e770afeb418916042886bf9ffa5b))

## [3.0.1](https://github.com/suites-dev/suites/compare/@suites/unit@3.0.0...@suites/unit@3.0.1) (2025-01-02)

**Note:** Version bump only for package @suites/unit
