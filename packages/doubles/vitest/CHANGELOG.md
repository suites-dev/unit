# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.2.0](https://github.com/suites-dev/unit/compare/%40suites%2Fdoubles.vitest%404.1.2...%40suites%2Fdoubles.vitest%404.2.0) (2026-11-09)

### Bug Fixes

* **doubles.vitest:** preserve supplied getter and setter descriptors ([3b8c278](https://github.com/suites-dev/unit/commit/3b8c27815779d71c93a3d3adf1fd43d84a203f85))

### Features

* **doubles.vitest:** preserve fluent builder APIs after mock overrides ([17842c3](https://github.com/suites-dev/unit/commit/17842c338064f286b14dada4c17bc03804446db0))


## [4.1.2](https://github.com/suites-dev/unit/compare/%40suites%2Fdoubles.vitest%404.1.1...%40suites%2Fdoubles.vitest%404.1.2) (2026-11-05)

**Note:** Version bump only for package @suites/doubles.vitest





## [4.1.1](https://github.com/suites-dev/unit/compare/%40suites%2Fdoubles.vitest%404.1.0...%40suites%2Fdoubles.vitest%404.1.1) (2026-11-05)

### Bug Fixes

* **doubles.vitest:** infer typed mocks from abstract dependency tokens ([8d9300a](https://github.com/suites-dev/unit/commit/8d9300a10c44d99eb8c2053db5e736020a615c75))


# [4.1.0](https://github.com/suites-dev/unit/compare/%40suites%2Fdoubles.vitest%404.0.0...%40suites%2Fdoubles.vitest%404.1.0) (2026-11-04)

### Features

* **doubles.vitest:** type lookups for adapter-registered tokens ([ad36afe](https://github.com/suites-dev/unit/commit/ad36afe2d6d49dfd7181164ab7017a891fdf8a73))


# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Fdoubles.vitest%403.1.0...%40suites%2Fdoubles.vitest%404.0.0) (2026-11-04)

### Bug Fixes

* **security:** harden release preview and update vulnerable tooling [skip ci] ([#1084](https://github.com/suites-dev/unit/issues/1084)) ([d7b287f](https://github.com/suites-dev/unit/commit/d7b287f080ea4ed11372865e738798c09e5c37f5))

### Features

* **doubles.vitest:** make Vitest type integration explicit ([b098029](https://github.com/suites-dev/unit/commit/b09802951ff0cb27686f01981a8198b4c6fd8967))

### BREAKING CHANGES

* **doubles.vitest:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.
  Add `/// <reference types="@suites/doubles.vitest/unit" />` to a `suites.d.ts` file included by your test tsconfig; installation no longer injects these types automatically.
  In the same file, also add `/// <reference types="@suites/di.nestjs/metadata" />` or `/// <reference types="@suites/di.inversify/metadata" />` for your selected DI adapter. Include one test-double reference and one DI reference per test TypeScript project.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/doubles.vitest@3.0.1...@suites/doubles.vitest@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- **doubles.vitest:** skip non-writable properties in mock proxy ([6c33f64](https://github.com/suites-dev/suites/commit/6c33f64d58b17d912ff552df08fe303cdf224a03))
- **doubles.vitest:** use raw target object for descriptor lookup in overrideMockImp ([30442e2](https://github.com/suites-dev/suites/commit/30442e28eabfac8a54a7f960400f3ddb6d0ecd24))
- **doubles.vitest:** use relative imports in type augmentation ([7d499a1](https://github.com/suites-dev/suites/commit/7d499a1503b3d662539a1ba66a24cb2c53f0770d))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **doubles.vitest:** add dual CJS/ESM build output ([29da3ef](https://github.com/suites-dev/suites/commit/29da3ef067bf31037fdf3328fc9d26dc0764b570))

## [3.0.1](https://github.com/suites-dev/suites/compare/@suites/doubles.vitest@3.0.0...@suites/doubles.vitest@3.0.1) (2025-01-02)

### Bug Fixes

- **doubles.vitest:** remove redundant import ([09dc869](https://github.com/suites-dev/suites/commit/09dc869de94b0953be4589c447a66fd5f2b5a40c))
