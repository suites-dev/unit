# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.1.3](https://github.com/suites-dev/unit/compare/%40suites%2Fcore.unit%404.1.2...%40suites%2Fcore.unit%404.1.3) (2026-11-11)

### Bug Fixes

* **core.unit:** track selected overrides in usage warnings ([4ba448f](https://github.com/suites-dev/unit/commit/4ba448f9))

## [4.1.2](https://github.com/suites-dev/unit/compare/%40suites%2Fcore.unit%404.1.1...%40suites%2Fcore.unit%404.1.2) (2026-11-05)

**Note:** Version bump only for package @suites/core.unit





## [4.1.1](https://github.com/suites-dev/unit/compare/%40suites%2Fcore.unit%404.1.0...%40suites%2Fcore.unit%404.1.1) (2026-11-05)

### Bug Fixes

* **core.unit:** support abstract tokens in mock configuration and lookups ([bb0b7b9](https://github.com/suites-dev/unit/commit/bb0b7b906e4e3d8dc12d8828dc8990ab15dc5a47))


# [4.1.0](https://github.com/suites-dev/unit/compare/%40suites%2Fcore.unit%404.0.0...%40suites%2Fcore.unit%404.1.0) (2026-11-04)

### Features

* **core.unit:** preserve object token identity in overrides and lookups ([b7a7971](https://github.com/suites-dev/unit/commit/b7a797114970260842da8231a89f158712e8ff35))


# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Fcore.unit%403.1.0...%40suites%2Fcore.unit%404.0.0) (2026-11-04)

### Features

* **core.unit:** move the core runtime to Suites 4 ([95b6631](https://github.com/suites-dev/unit/commit/95b6631b02ce6dfa154867665078c9ce90488471))

### BREAKING CHANGES

* **core.unit:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/core.unit@3.0.1...@suites/core.unit@3.1.0) (2026-05-05)

### Bug Fixes

- add .js extensions to relative imports ([b4fe35d](https://github.com/suites-dev/suites/commit/b4fe35da98263862ed0ce9523290ac948e0bc306))
- **core.unit:** add missing @suites/types.doubles dependency ([#806](https://github.com/suites-dev/suites/issues/806)) ([809d33e](https://github.com/suites-dev/suites/commit/809d33eda3f7d06e6c7523981823a7223bc99fbd))
- **core.unit:** add missing @suites/types.doubles dependency ([#925](https://github.com/suites-dev/suites/issues/925)) ([554cbb7](https://github.com/suites-dev/suites/commit/554cbb75e47e3cca30c38387176f8750997a2921))
- **core.unit:** remove @suites/types.doubles dependency ([463a102](https://github.com/suites-dev/suites/commit/463a1024941686f893d5059ee327718138d06504))
- **di.inversify,core:** use node util instead of lodash isequal ([#783](https://github.com/suites-dev/suites/issues/783)) ([b7b6f5b](https://github.com/suites-dev/suites/commit/b7b6f5b11961461da6dd034821298896a96e1889))
- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))

### Features

- **core.unit:** add dual CJS/ESM build output ([3e90b1d](https://github.com/suites-dev/suites/commit/3e90b1dd53f9cce302d770c4184dd1b9b076bb0d))

## [3.0.1](https://github.com/suites-dev/suites/compare/@suites/core.unit@3.0.0...@suites/core.unit@3.0.1) (2025-01-02)

### Bug Fixes

- **core:** add missing return for instantiated exposed classes ([#529](https://github.com/suites-dev/suites/issues/529)) ([85516e7](https://github.com/suites-dev/suites/commit/85516e79a638aeff218bdf4cf763cb12541ce53f))
