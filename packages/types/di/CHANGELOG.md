# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.1.2](https://github.com/suites-dev/unit/compare/%40suites%2Ftypes.di%404.1.1...%40suites%2Ftypes.di%404.1.2) (2026-11-05)

**Note:** Version bump only for package @suites/types.di





## [4.1.1](https://github.com/suites-dev/unit/compare/%40suites%2Ftypes.di%404.1.0...%40suites%2Ftypes.di%404.1.1) (2026-11-05)

### Bug Fixes

* **types.di:** accept abstract classes as dependency identifiers ([01c432b](https://github.com/suites-dev/unit/commit/01c432b61e8c6e4f78ac4e054ce0d16a67558b0e))


# [4.1.0](https://github.com/suites-dev/unit/compare/%40suites%2Ftypes.di%404.0.0...%40suites%2Ftypes.di%404.1.0) (2026-11-04)

### Features

* **types.di:** allow adapters to register dependency token types ([76ea267](https://github.com/suites-dev/unit/commit/76ea2673de1cf637db3631d4c48348fc4a53fa23))


# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Ftypes.di%403.1.0...%40suites%2Ftypes.di%404.0.0) (2026-11-04)

### Features

* **types.di:** register adapter metadata through module augmentation ([e984c0f](https://github.com/suites-dev/unit/commit/e984c0fa4f09b8ed475d49eda4af24685c783d53))
* **types.di:** require maintained Node releases for DI types ([3427e41](https://github.com/suites-dev/unit/commit/3427e41ef5ae5b383f1bc7d6d38ca25e685602d4))

### BREAKING CHANGES

* **types.di:** `IdentifierMetadata` now resolves through `IdentifierMetadataRegistry`. Load your DI adapter's `/metadata` reference in a declaration file included by your test tsconfig: `/// <reference types="@suites/di.nestjs/metadata" />` selects `never`, rejecting metadata arguments in `mock()` and `get()`, while `/// <reference types="@suites/di.inversify/metadata" />` selects named and tagged metadata objects. Without a DI reference the generic `Record<string | symbol, unknown>` fallback remains. Custom DI adapters can augment `IdentifierMetadataRegistry` with their own metadata type instead of editing installed declaration files.
* **types.di:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/types.di@3.0.0...@suites/types.di@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **types.di:** add dual CJS/ESM build output ([a75f645](https://github.com/suites-dev/suites/commit/a75f6450bd0133544ec9e3b1bdde6a336074a8f9))
