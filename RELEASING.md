# Release stable Suites packages

Releases use `master` and npm's `latest` tag. Lerna calculates independent package versions and changelogs from conventional commits. `suites-release-bot` opens the version PR, pushes signed package tags, and creates GitHub Releases; npm authenticates separately through Trusted Publishing.

```mermaid
flowchart LR
  A[Prepare Release: Lerna versions and changelogs] --> B[Review and merge release PR]
  B --> C[Tag Release starts automatically]
  C --> D[Approve tagging deployment]
  D --> E[Signed package tags and overall tag verified]
  E --> F[Run Publish Packages]
  F --> G[E2E and publication approval]
  G --> H[npm packages and GitHub Releases]
```

## One-time setup

The organization owns `suites-release-bot`. Install it on the repositories that should use it, with **Contents: read/write**, **Pull requests: read/write**, and **Metadata: read**. No branch-protection bypass is required.

Configure these organization Actions settings:

| Setting                                 | Value                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Variable `SUITES_RELEASE_APP_CLIENT_ID` | The app's client ID                                                             |
| Secret `SUITES_RELEASE_APP_PRIVATE_KEY` | The downloaded PEM private key, accessible to release-enabled repositories only |

Each workflow mints a short-lived token restricted to its own repository. The token action revokes it at job completion. Keep the PEM out of Git and workflow logs.

In `unit`, configure the `release` environment to require review by `omermorad` and allow deployment from `master` only.

Register a dedicated Ed25519 public key as a **Signing Key** on the release signer's GitHub account. Keep it separate from SSH authentication and from the GitHub App PEM. In Unit's protected `release` environment configure:

| Setting                                      | Value                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| Secret `SUITES_RELEASE_SIGNING_PRIVATE_KEY`  | Dedicated unencrypted OpenSSH private key                    |
| Variable `SUITES_RELEASE_SIGNING_PUBLIC_KEY` | Matching `ssh-ed25519` public key                            |
| Variable `SUITES_RELEASE_SIGNING_LOGIN`      | GitHub account owning the signing key, currently `omermorad` |

Tags are signed under this account's name and GitHub noreply email. The Release Bot still authenticates the push and creates the GitHub Releases. **Tag Release** checks that the public key is registered and proves the runner can sign and verify. Its private key is removed from the runner in an `always()` cleanup step. **Publish Packages** does not load the signing key or create Git tags.

GitHub's **Verified** badge is checked on each new annotated tag object through the API. `gh release create --verify-tag` only checks that a tag exists; it does not verify signatures. See [GitHub signing keys](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-tags).

For each of these npm packages, open **Settings → Trusted Publisher → GitHub Actions**:

- `@suites/unit`
- `@suites/core.unit`
- `@suites/di.nestjs`
- `@suites/di.inversify`
- `@suites/doubles.jest`
- `@suites/doubles.vitest`
- `@suites/types.common`
- `@suites/types.di`
- `@suites/types.doubles`

Use these exact values:

| npm field            | Value                  |
| -------------------- | ---------------------- |
| Organization or user | `suites-dev`           |
| Repository           | `unit`                 |
| Workflow filename    | `publish-packages.yml` |
| Environment          | `release`              |

The package repository URL must be `https://github.com/suites-dev/unit.git`. See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) for authentication requirements. The release workflows do not use `GH_TOKEN` or `NPM_TOKEN` secrets.

## Prepare and review versions

1. Run **Prepare Release** from `master`.
2. Choose `graduate` for the first stable release from the staged prereleases, or `stable` for subsequent conventional-commit releases.
3. Wait for the E2E matrix. The bot then opens a PR containing package versions, dependency ranges, the lockfile, and changelogs.
4. Review each changed package's version and release notes, including its `BREAKING CHANGE:` entries. Merge after CI passes and human review is complete. Merging a `chore/release-*` PR from this repository into `master` automatically starts **Tag Release**.

Preparation never pushes directly to `master`, publishes npm packages, or creates tags. Keep feature commits and their scopes and breaking-change footers in Git history so Lerna can generate meaningful package changelogs.

## Create the release tags

**Tag Release** is a separate workflow. It starts when a release PR is merged into `master`; other merged PRs do not trigger tagging. Approve its existing `release` environment deployment. For an already-merged release or a same-commit retry, run it manually from `master` or re-run the original run, respectively.

The action reads public package names and versions with `pnpm exec lerna list --json --no-private`. Lerna has already calculated these versions in **Prepare Release**. Tagging does not run `lerna version` again, bump versions, or change changelogs. It checks stable versions and changelog entries, signs the corresponding `@suites/package@version` tags, pushes them through the Release Bot, and verifies GitHub's signature status.

When `@suites/unit` belongs to this release commit, the action then signs and verifies the matching overall tag, such as `v4.0.0`. Existing tags are never moved. Unchanged independently versioned packages retain their previous source tags. The action creates neither npm publications nor GitHub Releases.

The run summary lists the tags and source commit. For Suites 4, expect nine package tags plus `v4.0.0` to appear on the repository Tags page before publishing.

## Publish an already-tagged commit

1. Wait for **Tag Release** to complete and copy its full source commit SHA.
2. Run **Publish Packages** from `master`, supplying that SHA as `commit` and, for Suites 4, `v4.0.0` as `release_tag`.
3. The plan requires existing verified package tags and the requested overall tag before E2E begins. Missing tags fail here; publishing cannot create them.
4. Wait for E2E tests on that exact commit, then approve the publication deployment in the `release` environment.

The supplied commit must equal the workflow's dispatch commit. This keeps npm provenance, the tested source, and `gitHead` aligned. Tag and publish the same reviewed master head before advancing it. If a workflow fails, re-run that original run at its original commit.

Publishing rechecks existing tags, publishes missing stable package versions to npm's `latest` tag, and verifies npm metadata and downloadable tarballs. Only then does it create package GitHub Releases from their changelogs and the overall **Suites v4.0.0** GitHub Release as Latest. Package releases remain marked `latest=false`.

## Recover a failed release

Re-run the failed workflow using the same commit after fixing the cause. Do not bump versions merely because a network request failed.

- **Checkout or bot authentication:** verify the app installation includes `unit`, and the organization variable and secret are accessible to it.
- **Tag Release signing setup:** confirm the public key is registered as a Signing Key on the configured account and matches the environment secret. This workflow never publishes npm packages.
- **Unverified tag:** inspect the tag object and GitHub verification reason. Do not overwrite it; rerun the same commit only after verification succeeds. An unsigned tag collision requires investigation because existing tags are immutable.
- **npm authentication:** check all nine Trusted Publisher entries, especially the exact workflow filename and `release` environment. No long-lived npm token is needed.
- **Missing package or overall tags:** complete **Tag Release** for the reviewed commit first. **Publish Packages** only verifies and consumes existing tags.
- **Tags created but npm publication failed:** the tags remain at their original source commit. Re-run the original workflow at that same commit; it verifies and reuses them before retrying missing uploads. Do not move tags or dispatch a newer commit for the same unpublished versions.
- **Partial npm upload:** existing versions are checked against their source commit and package contents. Matching published packages are preserved, and Lerna publishes only missing versions.
- **Registry propagation:** verification retries read-only checks for new versions for up to ten minutes. It never retries an upload itself.
- **Wrong source, changed package contents, or tag collision:** stop and inspect. A changed package needs a new version; never overwrite or move an existing release tag.
- **Published version with an unexpected `latest` tag:** inspect npm before proceeding. The workflow refuses to silently move an unexpected tag.
- **GitHub Releases failed after npm succeeded:** rerun with the same commit. Matching versions and tags are preserved; missing GitHub Releases are completed.

Unchanged independent packages may keep an earlier `gitHead`, tag, and `latest` value. The workflow accepts this only when the earlier source is an ancestor and that package's tracked contents are unchanged.
