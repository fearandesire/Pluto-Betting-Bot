# Ordinary PR delivery: pstack Autopilot-full

This is Pluto's repository contract for the installed pstack skills, not a new
workflow engine. Follow upstream [Autopilot-full][full], [opening a PR][open],
[babysit][babysit] and [shipping][ship] through the runtime's supported adapter.
Codex/OpenAI, Claude Code and OpenCode are the supported runtimes; no Cursor
subscription is required. Verify the installed port supports the selected runtime
before starting. A missing skill or tool is a blocker to report, not proof that a
step ran.

Model roles come from [`.claude/pstack-models.md`](../../.claude/pstack-models.md),
this project's sheet, which the root `CLAUDE.md` imports.

This repository is public. Everything in this file, every PR and every comment is
public, so keep the rules in `AGENTS.md` under "What is public and what is
private".

## Required external safety preflight

Before opening early-ready PRs, verify that external reviewers cannot
automatically mark ready, arm auto-merge or merge. The Pullfrog workflow runs with
`push: disabled` and `shell: restricted`. Those inputs restrict Git pushes and the
shell, not Pullfrog's GitHub approval and merge path, which lives in the Pullfrog
console.

A maintainer confirms in the Pullfrog console for this repository that
**Automations → Review PRs → Auto-merge approved PRs** and **Allow Pullfrog to
approve PRs** are off, and that **Address reviews** and both **Fix CI failures**
toggles are off. Until that is confirmed, keep affected PRs draft and report the
setup blocker. A prose request or a hold label is not an enforcement boundary.

## Ownership and flow

1. The coordinating agent owns the authorized queue. Assign one **agent owner
   role** per independent PR, with one writer per branch and isolated worktrees.
   The role persists through merge. Use fresh agents for new work and fix rounds,
   carrying branch, scope and evidence. Reuse an agent only for costly live state.
2. Branch from current `main`. Do not stack independent Autopilot-full tasks. Open
   the PR **ready early**, not draft, so CI and reviewers overlap implementation.
   **Ready is not code-ready, verified, or permission to merge.** Existing WIP,
   breaking changes, holds and releases stay held. Do not bulk-promote drafts.
3. Implement and run the checks below. Use the installed cleanup skills
   (`deslop`, `no-comments`) where supported. Report code-ready on the committed
   revision before final independent proof.
4. The coordinator runs a fresh independent `swarm`: relevant gates, real behavior
   in mock mode (see `AGENTS.md`, "Run it locally without secrets"), rendered
   previews of every changed screen, and a diff audit. Do not substitute green CI
   for that proof. If a surface is unavailable, report the missing evidence.
5. The owner follows CI and reviews, classifies failures, and fixes actionable
   findings. Reproduce real bugs and dismiss noise only with evidence. A suspected
   infrastructure flake gets one fresh run, not repeated blind retries.
6. Run the full swarm once on finished code and again after a major behavior or
   design change. Minor repairs and rebases get a focused fresh verifier;
   wording-only changes need none. Every new head still needs current-head CI.
7. Only after the coordinator's verdict covers the landing patch and every
   current-head requirement passes may the owner squash-merge to `main` or
   explicitly arm native auto-merge. Check the exact head and target again, and
   confirm **merged**, not queued. If auto-merge was armed and more work is
   needed, disable it before pushing, then re-verify. Never bypass protections.

Use `technical-writing` and `unslop` for PR prose and `show-me-your-work` for
readable evidence. Do not add labels, controllers or schedulers to imitate pstack.

## Pluto verification and landing contract

- Target: **`main`**. Squash with a Conventional Commit PR title; the allowed
  types live in `.github/workflows/pr-title.yml`.
- Read `AGENTS.md` and `REVIEW.md` first.
- Local gate: `pnpm typecheck`, `pnpm test:run`, `pnpm build` and the read-only
  `pnpm exec biome ci .`. `pnpm lint` rewrites files, so only the owner runs it
  and inspects the diff. For workflow changes also run `actionlint`.
- Required on `main`: `Verify` and `Validate PR title`. A pstack verdict does not
  stand in for either check.
- Pullfrog and CodeRabbit are not pstack's independent swarm. They report
  findings only. The owner applies fixes and resolves a thread only after
  addressing or disproving it; `isOutdated` alone is not resolution.
- Record local, CI and live results separately in the PR's Validation section,
  with the owner, code-ready revision and verifier verdict.

## Automation kept and retired

- Retired: `ready-when-green.yml`, which marked draft PRs ready when their checks
  passed. Readiness is the owner's call.
- Read-only now: the Pullfrog workflow (`push: disabled`, `shell: restricted`) and
  CodeRabbit (`request_changes_workflow: false`, so it never approves).
- Kept, because none acts on an ordinary feature PR:
  - `auto-merge-dependabot.yml` arms auto-merge only on Dependabot patch and
    minor PRs, pinned to the event's head commit.
  - `auto-merge-release-pr.yml` arms auto-merge only on `release-please--*` PRs
    after a maintainer applies `release-ready`.
  - `khronos-client-update.yml` opens and auto-merges only its own client-bump
    PR, after Verify passes.
  - `ci-cd-deployment.yml`, `pr-title.yml` and `release.yml`.

## Release boundary: unchanged

This flow does **not** authorize release PRs or deployment. Those stay under
separate explicit maintainer authority.

[full]: https://github.com/fearandesire/pstack-owned/blob/62b6ce689b273e8b9c00c8a144e351179f4fe659/plugins/pstack/skills/poteto-mode/playbooks/autopilot-full.md
[open]: https://github.com/fearandesire/pstack-owned/blob/62b6ce689b273e8b9c00c8a144e351179f4fe659/plugins/pstack/skills/poteto-mode/playbooks/opening-a-pr.md
[babysit]: https://github.com/fearandesire/pstack-owned/blob/62b6ce689b273e8b9c00c8a144e351179f4fe659/plugins/pstack/skills/poteto-mode/playbooks/babysit.md
[ship]: https://github.com/fearandesire/pstack-owned/blob/62b6ce689b273e8b9c00c8a144e351179f4fe659/plugins/pstack/skills/poteto-mode/playbooks/shipping.md
