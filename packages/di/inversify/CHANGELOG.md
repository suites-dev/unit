# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Fdi.inversify%403.1.0...%40suites%2Fdi.inversify%404.0.0) (2026-11-04)

### Features

* **di.inversify:** export the metadata type reference ([5d5d350](https://github.com/suites-dev/unit/commit/5d5d350c7eebc0aabd52fc470701e996320fe9e7))
* **di.inversify:** retain compatibility with Inversify 7 ([d79e312](https://github.com/suites-dev/unit/commit/d79e312d4f476461cc14e90b28dd2d97b5dbb71f))
* **di.inversify:** support Inversify 7/8, symbol properties, and combined named/tagged metadata ([b9520c8](https://github.com/suites-dev/unit/commit/b9520c86b3b284aba7ff76f121e38ace84ce40b1))

### BREAKING CHANGES

* **di.inversify:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.
  Requires Inversify `^7.0.0 || ^8.0.0`. Inversify 7 remains supported. When migrating from Inversify 6, replace `LazyServiceIdentifer` with `LazyServiceIdentifier` and `@targetName(value)` with `@named(value)`; select named mocks with `{ named: value }`. Use `@injectFromBase()` for inherited injection metadata. For constructor parameters using `@named(...)` or `@tagged(...)` that previously relied on inferred injection types, add `@inject(Dependency)` explicitly. Plain class-typed parameters without these decorators can still use inferred injection. Add `/// <reference types="@suites/di.inversify/metadata" />` to a `suites.d.ts` file included by your test tsconfig to load the adapter's named and tagged identifier metadata types. Installation no longer configures DI metadata types. Keep your chosen Jest or Vitest `/unit` reference in the same file.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/di.inversify@3.0.1...@suites/di.inversify@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- **di.inversify,core:** use node util instead of lodash isequal ([#783](https://github.com/suites-dev/suites/issues/783)) ([b7b6f5b](https://github.com/suites-dev/suites/commit/b7b6f5b11961461da6dd034821298896a96e1889))
- **di.inversify:** revert reflect-metadata version constraint ([4044bbb](https://github.com/suites-dev/suites/commit/4044bbb5fa3ebd8d9b75f48cb804232f35f0854d))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **di.inversify:** add dual CJS/ESM build output ([c6dafb0](https://github.com/suites-dev/suites/commit/c6dafb0dc5a81bc954ce5bdcc5e6ba28a09a1ca1))

## [3.0.1](https://github.com/suites-dev/suites/compare/@suites/di.inversify@3.0.1-next.0...@suites/di.inversify@3.0.1) (2025-01-02)

### Bug Fixes

- **di.inversify:** change interface import to type ([#547](https://github.com/suites-dev/suites/issues/547)) ([6430bf7](https://github.com/suites-dev/suites/commit/6430bf782726bb51aea2d5cf76f28c1066134fae))
