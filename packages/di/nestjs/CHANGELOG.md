# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.0.3](https://github.com/suites-dev/unit/compare/%40suites%2Fdi.nestjs%404.0.2...%40suites%2Fdi.nestjs%404.0.3) (2026-11-05)

**Note:** Version bump only for package @suites/di.nestjs





## [4.0.2](https://github.com/suites-dev/unit/compare/%40suites%2Fdi.nestjs%404.0.1...%40suites%2Fdi.nestjs%404.0.2) (2026-11-05)

**Note:** Version bump only for package @suites/di.nestjs





## [4.0.1](https://github.com/suites-dev/unit/compare/%40suites%2Fdi.nestjs%404.0.0...%40suites%2Fdi.nestjs%404.0.1) (2026-11-04)

**Note:** Version bump only for package @suites/di.nestjs





# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Fdi.nestjs%403.1.0...%40suites%2Fdi.nestjs%404.0.0) (2026-11-04)

### Features

* **di.nestjs:** implement the metadata type reference ([b8c1f53](https://github.com/suites-dev/unit/commit/b8c1f53b466399aa754310c230d8fb77fa80ed8c))
* **di.nestjs:** prepare the NestJS adapter for Suites 4 ([5850426](https://github.com/suites-dev/unit/commit/585042666bb7017cc31abadcfcff55235f680297))
* **di.nestjs:** retain NestJS 10 and 11 alongside 12 ([145999b](https://github.com/suites-dev/unit/commit/145999be13bf47c5e458b4ac88fc4f9dd82d8124))

### BREAKING CHANGES

* **di.nestjs:** Requires @nestjs/common in `^10.0.0 || ^11.0.0 || ^12.0.1`. NestJS 8 and 9 are no longer supported; NestJS 10 and 11 users can upgrade Suites without upgrading their framework major.
* **di.nestjs:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.
  Add `/// <reference types="@suites/di.nestjs/metadata" />` to a `suites.d.ts` file included by your test tsconfig. Installation no longer configures DI metadata types. This reference rejects metadata arguments in `mock()` and `get()` calls; omit those arguments for NestJS. Without the reference, metadata remains generic. Keep your chosen Jest or Vitest `/unit` reference in the same file.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/di.nestjs@3.0.1...@suites/di.nestjs@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **di.nestjs:** add dual CJS/ESM build output ([9fc56ec](https://github.com/suites-dev/suites/commit/9fc56ecba61c6f8441da03b94bc66dfb99f0a68e))

## [3.0.1](https://github.com/suites-dev/suites/compare/@suites/di.nestjs@3.0.1-next.0...@suites/di.nestjs@3.0.1) (2025-01-02)

**Note:** Version bump only for package @suites/di.nestjs
