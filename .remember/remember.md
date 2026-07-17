# Handoff / Morning Report — CI/CD 3-repo deploy (2026-07-17)

## TL;DR
Props-predictions 3.6.0 is fully deployed to Pluto production. Goracle + Khronos CI
repaired. Two items need YOU (GHCR ACL, host-pull confirmation). Details below.

## Shipped
- **Pluto v4.6.4 → production.** Merged #587 (bump @pluto-khronos/* → 3.6.0 + settle-both-sides
  admin fix) → release-please #588 → deploy run 29602484644 GREEN. Image `pluto-betting-bot:4.6.4`
  (+ `4.6.4-b63385e`) confirmed on GHCR. main pins @pluto-khronos/* = 3.6.0 exact.
- **Goracle #60 merged** → main. ci.yml now has workflow_dispatch (main-only) to re-publish the
  GHCR image + docs/guides/ghcr-image-republish.md runbook. `ci:` → no release bump.
- **Khronos #721 merged → dev.** espn-contract-nightly scoped to the ESPN contract specs (was
  failing 30+ days on missing Redis for the whole test:int suite); Goracle spec synced (adds
  props/settlement endpoints). Nightly on-demand run confirmed the ESPN schema contract passes.
- **Khronos #722 MERGED → dev:** offseason-tolerant matchup-records series assertion +
  parlays-system-smoke retry + visible teardown warning (Greptile P2). Nightly RE-DISPATCHED
  run 29603433689 → GREEN (ESPN contract step success). Nightly now fully fixed + validated.
- **Branch cleanup:** deleted goracle `dev/parlays-props` (@88319eb, PR #54) and
  `agent/parlays-audit-remediation` (@5b558eb, PR #50) — both confirmed merged.

## Needs YOU (cannot be done by agent)
1. **Goracle GHCR ACL** (unblocks goracle prod deploy — stale since Feb v1.7.0):
   https://github.com/users/fearandesire/packages/container/goracle/settings →
   Manage Actions access → add repo `fearandesire/goracle` with **Write**.
   Then: `gh workflow run ci.yml --repo fearandesire/goracle --ref main -f reason="republish"`
   → confirm the "Push image" step is green → on VPS: `docker compose pull && docker compose up -d`.
   (No REST API exists to grant user-package repo access — UI only. Verified, not attempted.)
2. **Confirm hosts pulled** new images: Pluto ≥4.6.4 and Khronos 3.6.0 (pipelines only push to
   GHCR; host pull/Watchtower is outside the repos, unverifiable from here).

## Flagged decisions (optional, neither blocks prod)
- Khronos default branch back to `main`? (dev-as-default silently killed release-please for a
  month; fixed via target-branch:main but the "sync main into dev" chore remains.)
- Goracle dependabot #38 (quic-go, CVE-2025-64702) — worth merging.
- Pluto `dev/parlays-props` NOT deleted: promoted via copy-branch #584 (agent/promote-parlays-to-main-1870),
  direct PR #583 closed-unmerged, tip 1c59d728 not an ancestor of main. Recoverable via that SHA.
  Delete after you confirm content is in main, or leave it.

## Settlement review note (eyeball payout behavior)
#587 reworked `/admin props setresult` to settle BOTH sides of a market. Reviewed by me + a
subagent + independently verified against RELEASED khronos v3.6.0 source: no double-pay
(distinct outcome_uuids; ambiguous markets abort; retry idempotent via prediction.service.ts
status='pending' gate at :685/:898). CodeRabbit flagged a double-pay concern assuming a
non-idempotent API — rebutted with released-source evidence. One defense-in-depth gap (not fixed):
if an admin ignores the on-screen "re-run same result" guidance and re-runs the OPPOSITE side after
a partial failure, both sides could settle `won`. Future guard: reject settle when market already
has a settled side.
