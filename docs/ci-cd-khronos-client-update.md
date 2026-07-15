# Khronos client update workflow

Pluto updates `@pluto-khronos/api-client` and `@pluto-khronos/types` through `.github/workflows/khronos-client-update.yml`.

Related Khronos docs:

- [Khronos release cascade](https://github.com/fearandesire/khronos/blob/main/docs/ci-cd-release-cascade.md)

## Trigger

The workflow runs on `repository_dispatch` with event type `khronos-release`.

Expected dispatch payload:

- `client_payload.khronos_version`: required npm version for both packages.
- `client_payload.sha`: Khronos source commit, linked in the generated PR body.

Khronos sends this dispatch after publishing the matching `@pluto-khronos/api-client` and `@pluto-khronos/types` packages.

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

- Verify failed: open or update the PR as a draft.
- Verify green: open or update the PR ready for review.

There is no auto-merge. A human reviews the dependency diff, checks API/schema impact, and merges manually.

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
5. Merge manually only after the dependency diff and verification result are acceptable.

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
