# Test the Vitest adapter across maintained Unit branches

Each branch builds its own Unit packages. The Unit 4 E2E run supplies one candidate
Vitest adapter tarball; the Unit 3 maintenance branch tests the same tarball.
No Unit version list or additional checkout is needed.

## Run in GitHub Actions

1. Run **E2E Tests** on the Unit 4 implementation branch. Its Node 26 / Vitest NestJS
   job uploads `vitest-adapter-candidate`.
2. Select `release/3.x` in **E2E Release Simulation**, then set
   `vitest_candidate_run` to that Unit 4 workflow run ID.
3. Confirm both runs pass and compare the adapter SHA256 recorded in their
   `vitest-compatibility-*` artifacts. It must be identical.

The maintenance branch starts at `@suites/unit@3.1.1`. Its own manifests and lockfile
supply the host packages. Backports on that branch are included automatically.
The workflow requires the shared adapter artifact; it does not build or test the
old Vitest or Sinon adapters.

On Unit 4, release simulation also accepts `vitest_candidate_run`. Without it,
that branch tests its own adapter build. After changing adapter code or metadata,
produce a new artifact and repeat both branch runs.

## Regression fixtures

The Redis reproduction and strict mock-type checks live under
[`nestjs/regressions/redis`](nestjs/regressions/redis). Both branch jobs reuse these
fixtures. Their separate compiler invocation preserves the reported inference
case and enforces the heap/time limit without applying it to unrelated E2E tests.
[`toolchains.json`](toolchains.json) contains the Vitest test configurations only;
Unit versions always come from the branch checkout.

## What is checked

- Full Redis mock inference from issue #1078 under TypeScript 5.9 and 6.
- Strict declarations, constructor-token inference, and rejected invalid mock calls.
- CJS and ESM consumers with Vitest 1 and 5 on Node 22, 24, and 26.
- Identical core and internal type package instances for Unit and the adapter.

Consumer projects install independently using pnpm, without dependency overrides
or package extensions. This does not establish support for two Unit majors in a
single pnpm workspace; that remains a separate peer-resolution case.

Before simulated versioning, `--prepare` packs the host packages and records their
versions, hashes, and checkout commit in `branch.json`. The candidate package
keeps its source version until the normal Lerna release process versions it.

`--run` publishes host archives only to the disposable localhost Verdaccio
registry. Suites packages cannot fall back to npmjs. Consumers install those
branch packages and the candidate tarball, then save their lockfiles as evidence.
The compiler regression has a 1 GiB heap limit and a 30-second timeout.

## Run locally

Build the branch using its declared package manager and lockfile. On Unit 4:

```sh
pnpm install --frozen-lockfile
pnpm build
node e2e/run-vitest-compatibility.cjs --prepare /tmp/unit4-vitest
```

On the Unit 3 maintenance branch:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter '@suites/unit...' --filter '@suites/di.nestjs...' -r run build
node e2e/run-vitest-compatibility.cjs --prepare /tmp/unit3-vitest /tmp/unit4-vitest/candidate
```

Use fresh output directories. Start a fresh registry for each branch run:

```sh
docker run -d --name suites-vitest-e2e -p 127.0.0.1:4873:4873 \
  -v "$PWD/e2e/config.yaml:/verdaccio/conf/config.yaml:ro" verdaccio/verdaccio
node e2e/run-vitest-compatibility.cjs --run /tmp/unit4-vitest
# For the maintenance branch, use /tmp/unit3-vitest instead.
docker rm -fv suites-vitest-e2e
```

Consumer tests use pnpm 12 and Node 22.22.2+, 24.15+, or 26. The maintenance branch
still uses its historical pnpm version for its own install, build, and pack steps.

## Release boundary

These workflows validate packages locally; they do not publish to npm or create
release tags. Adapter v5 is released from Unit 4's mainline. Unit 3 stays on its own
major. If a Unit 3 package patch becomes necessary, first backport the reviewed
Release Bot / Trusted Publishing lifecycle, use a separate npm channel, and keep
that release from replacing the latest Unit 4 GitHub release. The maintenance
branch's historical publishing workflows are not the release path for this work.
