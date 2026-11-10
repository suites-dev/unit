# Run consumer tests against a release

Use **Run E2E against a version** to run an existing consumer suite on clean GitHub-hosted machines against published npm packages or an unreleased candidate.

```text
Test source:     v4.1.2
Package target:  candidate commit
Consumer:       jest/nestjs
Node:           26.x
```

Test source and package target are independent. A release's version selects its complete package-version map, since the Suites packages do not all share one version number. A candidate is built once and distributed as tarballs. Nothing is published to a registry.

## Choose a remote run

After this workflow is merged into the default branch, open **Actions → Run E2E against a version → Run workflow**.

| Input           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| `target-kind`   | `npm` for published packages; `candidate` to build source                         |
| `target`        | An exact Unit npm version or `latest`; for candidates, a Git commit or ref        |
| `test-ref`      | Git revision containing the tests; empty uses the target's source commit          |
| `projects`      | `[]` discovers every consumer in the test snapshot; `["jest/nestjs"]` selects one |
| `node-versions` | Defaults to `["22.x","24.x","26.x"]`; narrow it for investigation                 |

For example, run the published 4.1.2 consumers against their own release:

```sh
gh workflow run remote-e2e.yml --repo suites-dev/unit \
  -f target-kind=npm -f target=4.1.2 \
  -f 'projects=["jest/nestjs"]' -f 'node-versions=["26.x"]'
```

To test a candidate with older consumers, set `target-kind=candidate`, `target` to the candidate commit, and `test-ref=v4.1.2`. An empty `test-ref` instead exercises the candidate's own suite.

Published targets require npm metadata identifying a Git source commit available in this repository. Missing releases, missing source, or missing test projects fail preparation; the runner does not substitute another release.

## Automatic backward-compatibility verification

The **Previous release compatibility** workflow runs on pull requests and is also called by release simulation. Prepare Release and Publish Packages already depend on that simulation, so they wait for this gate too.

The baseline is the newest published stable Unit version in the candidate's major, at or below its declared version. An unpublished Git tag never becomes a baseline. Before version preparation, this can be the same version declared by the candidate's manifest.

Each consumer/runtime job performs two executions:

1. Frozen baseline tests against the baseline's published package artifacts.
2. The same tests against candidate artifacts, with the baseline lockfile and exact external direct dependency versions carried over.

The runner checks every installed Suites dependency, including nested copies, against the selected target. It verifies tarball checksums and checks that the archived test/configuration files and test commands remain unchanged. Only dependency manifests, package overrides, and lockfiles are adjusted to select the target and retain the baseline toolchain. Other fixture installation settings are preserved. Peer dependency conflicts fail installation rather than being hidden.

| Result                 | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `passed`               | Both executions passed, or the requested standalone target passed                   |
| `baseline-unavailable` | The baseline could not install or pass its tests; compatibility was not established |
| `candidate-failed`     | The baseline passed but the candidate execution failed                              |
| `target-failed`        | A standalone requested target failed                                                |

The automatic gate requires a published baseline in the same major. Use the standalone runner to investigate intentional major changes. It does not silently waive failures for a new major.

This verifies the behavior represented in the selected suite. It cannot detect an uncovered contract or a test removed from that historical suite. Current E2E tests, DI-version coverage, and mixed-version TypeScript checks remain separate gates.

## Read the evidence

Each job summary records the test commit, target, baseline, Node version, and result. The input artifact contains `plan.json`, frozen tests, and integrity-checked package tarballs. Consumer artifacts contain `result.json`, install/test logs, the installed dependency inventory, and lockfiles. Download the logs when an installation or test fails.

Registry lookups use a fresh temporary npm cache per preparation, so an old local metadata cache cannot choose the baseline. Within a prepared bundle, refs and versions are resolved once; retries consume that frozen bundle.

## Reuse the workflow or its steps

```yaml
jobs:
  previous-release:
    uses: ./.github/workflows/run-consumer-e2e.yml
    with:
      target-kind: candidate
      target: ${{ github.sha }}
      baseline-version: previous
      artifact-name: previous-release
```

Use a unique `artifact-name` for each invocation within one workflow run.

| Module                                                                       | Responsibility                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Remote entry point](../.github/workflows/remote-e2e.yml)                    | Manual inputs                                                                    |
| [Compatibility entry point](../.github/workflows/backward-compatibility.yml) | Automatic baseline policy                                                        |
| [Reusable workflow](../.github/workflows/run-consumer-e2e.yml)               | Preparation, artifact transfer, consumer/runtime matrix                          |
| [Tool setup composite](../.github/actions/setup-e2e-tools/action.yml)        | Node and pnpm setup                                                              |
| [Preparation composite](../.github/actions/prepare-e2e-target/action.yml)    | Candidate build and input freezing                                               |
| [Consumer composite](../.github/actions/run-e2e-consumer/action.yml)         | Execute an isolated consumer                                                     |
| [Node modules](../scripts/e2e/cli.cjs)                                       | Registry targets, Git snapshots, package verification, and result classification |

The composites do not need registry credentials, release secrets, or write permissions. The reusable workflow uses `contents: read`.

## Run the same machinery locally

Use Node 26 and pnpm 12.16.1 to build the candidate first. Commit package source changes so the reported commit identifies what is packed. Use new output directories for each run:

```sh
pnpm install --frozen-lockfile
pnpm build
E2E_TARGET_KIND=candidate E2E_BASELINE=previous \
  node scripts/e2e/cli.cjs prepare /tmp/suites-e2e-bundle
node scripts/e2e/cli.cjs run /tmp/suites-e2e-bundle jest/nestjs /tmp/suites-e2e-consumer
```

For a published target, use `E2E_TARGET_KIND=npm E2E_TARGET=4.1.2` during preparation; no local build is required. `E2E_TEST_REF`, `E2E_PROJECTS`, and `E2E_NODES` provide the corresponding workflow selectors. Run `node --test scripts/e2e-harness.test.cjs` when changing harness policy or orchestration. Validate changed YAML with `actionlint`, and update this guide when inputs or evidence formats change.
