# Khronos client update workflow

Pluto updates `@pluto-khronos/api-client` and `@pluto-khronos/types` through `.github/workflows/khronos-client-update.yml`.

Related Khronos docs:

- [Khronos release cascade](https://github.com/fearandesire/khronos/blob/main/docs/ci-cd-release-cascade.md)

## Triggers

The bump job runs on `repository_dispatch` with event type `khronos-release`.

Expected dispatch payload:

- `client_payload.khronos_version`: required npm version for both packages.
- `client_payload.sha`: Khronos source commit, linked in the generated PR body.

Khronos sends this dispatch after publishing the matching `@pluto-khronos/api-client` and `@pluto-khronos/types` packages.

A separate confirmation job watches pushes to `main` that change
`pnpm-lock.yaml`. It compares `package.json` at the push's before and after
commits, requires both Khronos dependencies to have changed, and requires the
new versions to match. This prevents unrelated lockfile changes from producing
false green notifications and does not depend on repository squash-message
settings.

## Branch and PR behavior

The workflow always uses the static branch `deps/khronos-update`.

That static branch is intentional: if Khronos publishes again while an earlier update PR is still open, re-dispatch updates the same branch and PR instead of opening duplicate dependency PRs.

If `package.json` and `pnpm-lock.yaml` do not change, the workflow logs that Pluto is already on the requested version and does not open a PR.

## Verification gate

The workflow bumps both Khronos packages in lockstep, installs dependencies, then runs:

```bash
pnpm typecheck
pnpm build
pnpm test:run
```

The verify step is `continue-on-error: true` so the workflow can still open a PR when consumer fixes are needed.

PR state depends on the verify outcome:

- Verify failed: open or update the PR as a **draft**. Draft PRs are never
  auto-merged — a human fixes the consumers in the branch, marks it ready, and
  merges manually.
- Verify green: open or update the PR and **enable GitHub auto-merge (squash)**.
  The PR merges itself once the required checks pass (`Verify` and
  `Validate PR title`). This is the zero-touch happy path — no human click.

The bump PR title is `deps(khronos): …`. `deps` is an allowed type in
`.github/workflows/pr-title.yml`, so the required `Validate PR title` check
passes and does not block auto-merge. (The eventual squash still lands as
`fix(khronos)` via the `BEGIN_COMMIT_OVERRIDE` block below.)

## Auth: GitHub App token

The workflow's git-writing steps (checkout, create-pull-request, and the
`gh pr merge --auto` call) authenticate with a short-lived token minted from
the `fnx-cascade-bot` GitHub App (`CASCADE_APP_ID` /
`CASCADE_APP_PRIVATE_KEY`), replacing the older `PLUTO_BOT_PAT`. An App-token
PR still fires normal `pull_request` events, so the required checks run and
gate the auto-merge.

Discord notifications use state-based colors:

- Yellow, auto-merge in flight: verification passed and squash auto-merge is
  armed, but the bump has not landed on `main` yet.
- Yellow, action needed: verification failed and the PR remains a draft.
- Green, landed: the generated bump squash commit is on `main`, and both
  `@pluto-khronos` dependencies are present at the same version.
- Red, failed: the dispatch/bump job failed unexpectedly.

Notification delivery remains `continue-on-error`; a missing webhook noops and
does not block the dependency workflow.

## Finding and reviewing the PR

Find the active update PR:

```bash
gh pr list --head deps/khronos-update --state open
```

Read the PR and changed files:

```bash
gh pr view <number>
gh pr diff <number>
```

Read workflow status and logs:

```bash
gh pr view <number> --json isDraft,body,statusCheckRollup
gh run list --workflow "Khronos client update" --branch deps/khronos-update
gh run view <run-id> --log
```

Review checklist:

1. Confirm both `@pluto-khronos/api-client` and `@pluto-khronos/types` moved to the same Khronos version.
2. Check the linked Khronos commit and release notes for API or schema changes.
3. Inspect Pluto compile/test failures if the PR is draft.
4. Look for generated client API changes that require call-site updates in Pluto.
5. A verified PR auto-merges once required checks pass — no manual merge needed.
   Yellow means that merge is still in flight; green arrives only after the
   bump lands on `main`. To stop it, disable auto-merge on the PR or convert it
   to a draft before the checks finish. Only a **draft** (verify-failed) PR
   requires a manual merge after you fix the consumers.

## Release-please commit override

The generated PR body includes:

```text
BEGIN_COMMIT_OVERRIDE
fix(khronos): bump @pluto-khronos/* to <version>
END_COMMIT_OVERRIDE
```

This tells release-please to classify the eventual squash merge as `fix(khronos)` instead of `deps(khronos)`, producing a patch release and a changelog entry under fixes/updates.

## Recovery

If Pluto did not receive or process a Khronos release dispatch, recover from Khronos by rerunning or repairing the dispatch workflow in `.github/workflows/pluto-dispatch.yml`.

After redispatch, confirm that Pluto updated the static `deps/khronos-update` branch and that the PR body points at the expected Khronos version and commit.
