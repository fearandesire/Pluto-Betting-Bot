# Release process

Pluto releases are cut by release-please and shipped by GitHub Actions. Merging a pull request into `main` does not ship it. Shipping happens when the open release pull request merges.

## Steps

1. Every merge to `main` runs `release.yml`. release-please keeps one open `release-please--*` pull request that collects every releasable commit since the last release, with the version bump and the `CHANGELOG.md` entry. Version bumps follow Conventional Commits through `.github/release-please-config.json`.
2. A maintainer approves the batch by adding the `release-ready` label to that pull request. `auto-merge-release-pr.yml` then arms squash auto-merge for the exact head the label was applied to, and the pull request merges once `Verify` is green.
3. Adding `hold` disarms auto-merge. Any new commit on the release pull request, which happens when release-please adds more merged work to the batch, removes `release-ready` and disarms it, so the larger batch needs a fresh label. If the label is already on and nothing armed, remove it and add it again.
4. When the release pull request merges, `release.yml` publishes the GitHub release and tag. It authenticates with a `fnx-cascade-bot` GitHub App token rather than `GITHUB_TOKEN`, because events created with `GITHUB_TOKEN` would not start the deploy workflow.
5. The published release starts the `Deploy` job in `ci-cd-deployment.yml` after `Verify` passes. It builds the Docker image, checks it in a real container, and pushes it to GHCR tagged with the version, the short commit SHA, both together, and `latest`.
6. `release.yml` also sends a `pluto-release` dispatch to the docs site's changelog workflow. If that dispatch does not go out, a Discord notice says so and the docs site's daily schedule picks the release up.

Because anything on `main` can ship in the next batch, new behaviour should land behind a default-off flag.

## Khronos client bumps

`khronos-client-update.yml` opens `deps(khronos): …` pull requests that merge themselves when verification passes. Like any other merge, a landed bump ships only with the next release batch. See [Khronos client update workflow](ci-cd-khronos-client-update.md).

## Manual deploy

`ci-cd-deployment.yml` can be dispatched by hand on `main` with `force_build` to run `Deploy` without a release. `dry_run` builds and loads the image without pushing it, and `version_override` sets the version tag.

## Notifications

Each stage posts a Discord embed to `DISCORD_CICD_WEBHOOK` when that secret is set. Required repository secrets: `CASCADE_APP_ID`, `CASCADE_APP_PRIVATE_KEY` and `DISCORD_CICD_WEBHOOK`.
