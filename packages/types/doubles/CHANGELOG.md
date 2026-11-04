# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.0.0](https://github.com/suites-dev/unit/compare/%40suites%2Ftypes.doubles%403.1.0...%40suites%2Ftypes.doubles%404.0.0) (2026-11-04)

### Features

* **types.doubles:** require maintained Node releases for double types ([d7566ec](https://github.com/suites-dev/unit/commit/d7566ec1cc82c882b563157d4969354671f21b78))

### BREAKING CHANGES

* **types.doubles:** Requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`. Node.js versions below 22 and majors outside this range are no longer supported. Upgrade installed Suites packages together to version 4.


# [3.1.0](https://github.com/suites-dev/suites/compare/@suites/types.doubles@3.0.0...@suites/types.doubles@3.1.0) (2026-05-05)

### Bug Fixes

- downgrade to pnpm 8.15.9 for Node 16 compatibility ([d9650fa](https://github.com/suites-dev/suites/commit/d9650faffc785ff5a2d649948604617fbc332215))
- **types.doubles:** add missing @suites/types.common dependency ([#923](https://github.com/suites-dev/suites/issues/923)) ([af2f894](https://github.com/suites-dev/suites/commit/af2f894e3aa4fb9ae078ddd85050ace76609d943))
- **types.doubles:** remove Node >= 20 engine requirement and @suites/types.common dependency ([b079da7](https://github.com/suites-dev/suites/commit/b079da791acc33985ffb1b4d7ff0699ad68e6a50))

### Features

- **types.doubles:** add dual CJS/ESM build output ([2b4ce12](https://github.com/suites-dev/suites/commit/2b4ce12fb65dc99f69fccf1e30c41b0da863a5b5))
