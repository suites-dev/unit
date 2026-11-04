# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Fdoubles.jest%403.1.0...%40suites%2Fdoubles.jest%404.0.0) (2026-11-04)

### Features

* **doubles.jest:** load Jest globals explicitly for CommonJS and ESM ([b20daf3](https://github.com/suites-dev/unit/commit/b20daf32f292789c12cca7e2b76b54b82664bec3))

### BREAKING CHANGES

* **doubles.jest:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.
  Requires matching jest and `@jest/globals` versions in `^30.5.2`. Add `/// <reference types="@suites/doubles.jest/unit" />` to a `suites.d.ts` file included by your test tsconfig; installation no longer injects these types automatically.
  In the same file, also add `/// <reference types="@suites/di.nestjs/metadata" />` or `/// <reference types="@suites/di.inversify/metadata" />` for your selected DI adapter. Include one test-double reference and one DI reference per test TypeScript project.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/doubles.jest@3.0.1...@suites/doubles.jest@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- **doubles.jest:** skip non-writable properties in mock proxy ([14f2598](https://github.com/suites-dev/suites/commit/14f259850ba9b5d5333621f7da67efc20fde7392))
- **doubles.jest:** use raw target object for descriptor lookup in overrideMockImp ([b9e27fd](https://github.com/suites-dev/suites/commit/b9e27fdbe134719aa091e8411018e49bca58f77c))
- **doubles.jest:** use relative imports in type augmentation ([710312b](https://github.com/suites-dev/suites/commit/710312b4b9632e4b94860be62a4b22da0627cc37))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **doubles.jest:** add dual CJS/ESM build output ([e82bd57](https://github.com/suites-dev/suites/commit/e82bd576fc565711a03e494b0447d8265a8acac3))

## [3.0.1](https://github.com/suites-dev/suites/compare/@suites/doubles.jest@3.0.0...@suites/doubles.jest@3.0.1) (2025-01-02)

### Bug Fixes

- **doubles.jest:** remove redundant import ([315422a](https://github.com/suites-dev/suites/commit/315422a59c7d9804f9d0e6e3d0d24e16f3a95d44))
