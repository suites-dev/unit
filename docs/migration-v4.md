# Upgrading to Suites 4

Suites 4 moves the package family to maintained Node.js releases. This branch stages `4.0.0-next.0`; it does not publish a release or move npm distribution tags.

## Choose a supported Node release

| Node major | Minimum version |
| ---------- | --------------- |
| 22         | 22.22.2         |
| 24         | 24.15.0         |
| 26         | 26.0.0          |

Node 16, 18, 20, odd-numbered majors, and untested future majors are outside the Suites 4 engine range. Applications that still need the older runtime range can remain on Suites 3.x.

## Upgrade the package family together

Once the Suites 4 prerelease is published to the `next` tag, upgrade `@suites/unit` and the DI and test-double adapters your project uses in the same install. For a NestJS project using Jest:

```bash
pnpm add --save-dev @suites/unit@next @suites/di.nestjs@next @suites/doubles.jest@next
```

Keep `reflect-metadata` as a runtime dependency where your DI framework requires it. Run your existing tests after upgrading; the `TestBed` API is unchanged by this runtime migration.

### Replace the retired Sinon adapter

Suites 4 removes Sinon support. `@suites/doubles.sinon` is no longer maintained and will not receive a Suites 4 release. Remove it from your dependencies and migrate your tests to `@suites/doubles.jest` or `@suites/doubles.vitest`, including their test runner, stub calls, assertions, and type reference.

For example, replace Sinon `.returns(value)` and `.resolves(value)` calls with Jest or Vitest `.mockReturnValue(value)` and `.mockResolvedValue(value)`. Replace `stub.calledWith(argument)` assertions with `expect(stub).toHaveBeenCalledWith(argument)`. Suites 4 does not discover or load the old Sinon adapter, even if it remains installed.

### Load your adapter types explicitly

Add a `suites.d.ts` file included by your test `tsconfig.json`, choosing your test-double and DI adapters:

```ts
/// <reference types="@suites/doubles.jest/unit" />
/// <reference types="@suites/di.nestjs/metadata" />
```

For Vitest, replace `jest` with `vitest`. For Inversify, replace `nestjs` with `inversify`. Include one test-double reference and one DI reference per test TypeScript project.

The `/unit` reference enables `Mocked<T>`, `Stub`, and framework-specific mock methods. The `/metadata` reference selects the DI adapter's identifier metadata: NestJS rejects a metadata argument, while Inversify accepts named and tagged metadata objects. Without a DI reference, metadata remains generic.

Suites 4 removes install scripts that edited neighboring packages. TypeScript now loads these packaged declaration files directly. This works with pnpm's isolated dependencies and with lifecycle scripts disabled; `reflect-metadata` is still needed at runtime for decorators.

### Update Jest together with its globals

The Jest adapter requires matching Jest and `@jest/globals` 30.5.2 or later in the 30.x line. It imports the Jest runtime explicitly so both CommonJS and ESM tests can use it.

### Choose a supported DI framework version

| Framework | Supported versions                      |
| --------- | --------------------------------------- |
| NestJS    | 10.x, 11.x, and 12.x starting at 12.0.1 |
| Inversify | 7.x and 8.x                             |

NestJS 10/11 and Inversify 7 remain supported. You can upgrade Suites without changing those framework majors. The peer ranges exclude NestJS 8/9, Inversify 6, and future untested majors.

The Inversify adapter reads the public metadata model shared by versions 7 and 8. When migrating from Inversify 6, use `LazyServiceIdentifier`, replace removed `@targetName('value')` decorators with `@named('value')`, and use `@injectFromBase()` for inherited injection metadata. Select named mocks with `{ named: 'value' }` in `TestBed.mock()` or `unitRef.get()`. See the [Inversify migration guide](https://inversify.io/docs/guides/migrating-from-v6/) for framework changes.

The Node 26 type definitions used to develop Suites do not require consumers to run Node 26. Consumer tests also run on Node 22 and 24.

## Develop and test Suites

Use Node 26 and pnpm 12.16.1. The development compiler is TypeScript 6.0, the newest compiler supported by both ts-jest and the ESLint parser. TypeScript 7 is outside their supported peer ranges. The test toolchain uses Jest 30 and a matching Vitest 5 runner, spy, and coverage provider.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

The root pnpm workspace includes E2E linting. Each E2E consumer fixture installs published packages in its own pnpm workspace; the fixtures deliberately do not link the source packages. Yarn lockfiles are removed.

CI and the local Docker runner test the minimum and current release in every supported DI major. The cases live in `e2e/di-compatibility.json`; the runner verifies that the consumer and adapter resolve the same framework version before running each fixture. Installs use strict peer checks with lifecycle scripts disabled, and declarations are checked with `skipLibCheck: false`.

The package manifests and internal workspace dependencies are staged at `4.0.0-next.0`. Release maintainers should publish prereleases with the `next` distribution tag. Use the existing Prepare Release workflow's graduate operation when promoting the tested prerelease to stable 4.0.0, then publish with `latest`. Do not publish the staged prerelease under `latest`.

### Preserve package release history

Merge the Suites 4 upgrade into `next` with a merge commit or rebase merge. Preserve those commits when promoting `next` to `master`; do not squash either merge. Lerna reads commits that touch each package directory to generate that package's changelog.

Use package-scoped headers such as `feat(unit): support Node 22, 24, and 26` with an explicit `BREAKING CHANGE:` footer explaining the required migration. The configured Angular changelog parser does not recognize `!` in headers, so use the footer to mark breaking changes. Keep tooling and CI commits separate from package changes.

Run **Release Preview** on `next` with `prerelease` before preparing a prerelease, and with `graduate` before promoting to stable. Review every package's proposed version and generated changelog, including its breaking-change notes. Changelogs accumulate changes since each package's previous stable tag, so graduation retains the complete migration notes from prereleases. **Prepare Release** writes and commits those changelogs; the preview itself does not commit, tag, push, or publish.

Dependency updates for Jest, Vitest, and ESLint are grouped so companion packages can be reviewed and tested together.

## Remaining upstream security advisories

The upgrade includes patched undici and glob releases. Two development-only advisories still need upstream fixes or migrations:

- `deepmerge` 4.3.1 is used by Jest configuration and has no patched release.
- Nx still calls `minimatch.makeRe()`, which minimatch 11 removed. Forcing minimatch 11 would break Nx. The workspace stays on the latest compatible 10.x release until Nx migrates.

These findings remain visible in `pnpm audit`; they are not suppressed.
