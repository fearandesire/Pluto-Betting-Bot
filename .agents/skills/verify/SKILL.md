---
name: verify
description: Launch and drive Pluto Betting Bot's isolated acceptance surface, capture source-stamped evidence, and verify critical generated inputs. Run before task completion or creating/updating a pull request.
---

# Verify Pluto Betting Bot

Read [features/README.md](features/README.md) for the mapped user journeys and external prerequisites.

## Launch

Install this worktree's dependencies with `corepack pnpm@10 install --frozen-lockfile`, then run:

```sh
node scripts/verify.mjs
```

Use an owned worktree. The command owns its child processes and scratch files. It runs the configured production acceptance driver from `scripts/verification/config.json`; no installed or shared service is driven. The command exits zero only after every required step passed and source stayed unchanged.

## Doctor

The runner records `git rev-parse HEAD`, the tree, dirty status and a fingerprint of the current diff plus untracked source. Each driver checks usability before actions: CLI help and parsed output for Dexter, HTTP readiness for Nocturne, or HTTP/auth/content for Pluto. Any unexpected result fails the command. Inspect the failing run's manifest/log before a fresh run; never reuse an unverified shared instance.

## Drive

The feature map supplies the concrete production entrypoints and observable outcomes. The command also runs 200 generated examples per property with fast-check. The manifest records the seed; rerun with `VERIFY_SEED=<seed> node scripts/verify.mjs` on POSIX, or set `$env:VERIFY_SEED` in PowerShell. fast-check prints the seed and shrinking path on failure. The tests protect the existing critical module, not a duplicate implementation.

## Evidence

Every run writes `.verification/<UTC timestamp>-<id>/manifest.json`, per-step logs and driver receipts. It records actual source SHA/tree/fingerprint, dirty state, UTC times, command arguments, durations and passed/failed/skipped checks. Required skips/failures cannot produce a pass. Optional live external checks are listed with reasons; an offline pass proves only the stated scope. Run after the final commit to bind evidence to that exact clean SHA, and before creating or updating each PR. CI invokes the same command in its existing validation job and uploads the run directory even on failure.

## Cleanup

Drivers close their own HTTP listeners/contexts; the coordinator terminates only the process groups it launched, including on timeout or interruption. Cleanup preserves the entire run directory and verifies the manifest still exists. Never kill by process name or remove another worktree's state. Retain evidence outside source control; any public PR media must be redacted and uploaded through the approved R2 `agent-media` workflow.

## Helpers

`node scripts/verify.mjs` is the executable coordinator; its config lists the exact driver commands. The runner enforces per-step timeouts and a two-worker property-test cap. Invoke the command again only after an actual source/environment change or to stamp the final commit. Keep existing Git hooks active. Use PStack's maintenance workflow when the mapped app behavior changes.
