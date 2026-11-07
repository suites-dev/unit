# Vitest E2E across Unit releases

The Redis client test runs alongside the other NestJS tests in
[`nestjs/redis.e2e.test.ts`](nestjs/redis.e2e.test.ts). Mock inference and invalid-call
checks live in [`nestjs/type-safety.e2e.test.ts`](nestjs/type-safety.e2e.test.ts).
Both use the project's normal `pnpm test` command, TypeScript config, and Vitest
config. There is no separate fixture project, compiler configuration, or toolchain
matrix for this case.

## Test the shared adapter on Unit 3 and Unit 4

1. Run **E2E Tests** on the Unit 4 implementation branch. The Node 26 / Vitest
   NestJS job uploads `vitest-adapter-candidate`.
2. Run **E2E Release Simulation** on `release/3.x` (or its PR branch), setting
   `vitest_candidate_run` to that Unit 4 run ID.
3. Check both runs on Node 22, 24, and 26. Compare the adapter SHA256 in the
   `vitest-compatibility-*` artifacts; it must match.

Each checkout supplies its own Unit packages and its existing Vitest/NestJS E2E
project. The helper only packages and installs the branch's Unit dependencies,
substitutes the shared adapter tarball, and runs that project's `pnpm test`.
Its compiler and runner versions come from the project's package.json.

Before simulated versioning, `--prepare` records package versions, hashes, and
the checkout commit in `branch.json`. `--run` publishes those archives only to a
disposable localhost Verdaccio registry. Suites packages cannot fall back to npmjs.
It verifies that Unit and the adapter resolve identical core/type packages, then
saves the consumer lockfile alongside the manifest as CI evidence.

## Run locally

Build the checkout using its own lockfile and package manager. On Unit 4:

```sh
pnpm install --frozen-lockfile
pnpm build
node e2e/run-vitest-compatibility.cjs --prepare /tmp/unit4-vitest
```

On Unit 3, build only the host packages and reuse that candidate:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter '@suites/unit...' --filter '@suites/di.nestjs...' -r run build
node e2e/run-vitest-compatibility.cjs --prepare /tmp/unit3-vitest /tmp/unit4-vitest/candidate
```

Use fresh output directories and a fresh registry per branch:

```sh
docker run -d --name suites-vitest-e2e -p 127.0.0.1:4873:4873 \
  -v "$PWD/e2e/config.yaml:/verdaccio/conf/config.yaml:ro" verdaccio/verdaccio
node e2e/run-vitest-compatibility.cjs --run /tmp/unit4-vitest
# Use /tmp/unit3-vitest for the Unit 3 checkout.
docker rm -fv suites-vitest-e2e
```

Consumer installs use pnpm 12 on supported Node 22, 24, or 26. Unit 3 retains its
historical package manager for building and packing its own packages. Its old
Vitest and Sinon adapters are not built by this cross-branch check.

This flow creates no public releases or tags. Adapter v5 belongs to mainline;
Unit 3 remains on `release/3.x`. A future Unit 3 package release first needs the
reviewed Release Bot / Trusted Publishing lifecycle backported, a separate npm
channel, and a GitHub release that does not replace Unit 4 as latest.
