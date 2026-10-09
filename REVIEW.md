# Reviewing Pluto

For any reviewer, human or AI. Pluto is the Discord UI for the betting platform and the durable receiver of Khronos notifications. It holds no ledger of its own: Khronos moves the money, and Pluto shows users what happened. Every push to `main` runs Release Please. An ordinary source or documentation push may update or open a release PR; it does not itself publish or deploy. Merging a Release Please PR to `main` publishes the GitHub release and triggers production Deploy. Deploy also runs on a manual main-branch `workflow_dispatch` with `force_build=true`. The `docs` changelog section is hidden, and this docs-only PR does not create a release. Review release-triggering commit types and workflow changes as production-impacting.

Contribution rules live in `CONTRIBUTING.md`, the Components V2 checklist in `docs/components-v2/README.md`, the receiver design in `docs/features/durable-notification-receiver.md`. This file says where to look hardest and why.

## Review loop

1. **Map.** Match each changed path to a row in *Blast radius*. A path in no row gets an ordinary correctness review.
2. **Rank.** The *Undo* column sets severity. When undo is "no", any doubt is a finding. When undo is "yes", report defects only.
3. **Check.** Apply that row's checks to the diff. Answer each from the code at head, never from the PR description.
4. **Threads.** Read every open bot thread on the PR. This repo's PRs often merge within minutes, before bots finish; P1 findings from Greptile, Devin and Baz land afterwards and many stay open (#604, #607, #609, #618, #677, #682). Treat a still-true thread as a finding.
5. **Evidence.** A change users can see needs a screenshot or the PR's own "not verified live" line. Treat the second as a reason to hold.

Done when every changed hot path has a verdict (clear or finding) and the review names which paths it treated as hot. Report each finding as: path, what breaks, who is hurt, undo.

## Blast radius

| Area | Paths | A bug does | Undo |
|---|---|---|---|
| Notification delivery | `src/utils/api/routes/notifications/delivery-queue.ts`, `delivery-store.ts`, `delivery-contract.ts` | Khronos already got 202, then the Discord message is lost, duplicated, or marked delivered after a reject (#605) | Failed jobs are kept and replayable by `delivery_id`. A sent message cannot be unsent |
| Settlement payload validation | `*-notification-utils.ts`, `*-payload-schemas.ts` | A too-strict check returns 422 and the user sees Pending forever (#676) | Yes after fix |
| Bet confirm and placement | `src/utils/api/Khronos/bets/BetslipsManager.ts`, `src/interaction-handlers/ButtonListener.ts` | Wager placed but user sees an error; cached bet already cleared so retry is impossible (#607) | The Khronos wager is not reversible from here |
| Parlay builder | `src/services/ParlayBuilderService.ts`, `parlay-button-handler.ts`, `parlay-modal-handler.ts` | Double placement, cancel racing confirm, builder wedged for the lock TTL (#578) | Placement: no. Stuck state heals on TTL |
| Components V2 | `src/lib/discord/v2/` | Discord 400 on send or edit: no betslip, dead buttons on old messages (#653) | Revert and redeploy; posted messages stay broken |
| Matchup artwork | `matchup-image-resolver.ts`, `scripts/matchup-assets/`, `config/matchup-assets-release.json` | Wrong team logo in a public game channel; deploy fails at hydrate when the R2 object is missing | Redeploy the previous digest; posted images stay |
| Game channels | `src/utils/guilds/channels/` | Duplicate or missing daily game channels (#604, #618) | Manual |
| Alerts and shutdown | `src/services/alerts/`, `src/lib/startup/shutdown.ts`, `docker-compose.yml` | Stale or false incidents; in-flight jobs killed on every deploy (#604, #609) | Self-heals; a lost incident is gone |
| Inbound API auth and logging | `src/utils/api/koa/setup/apiKeyAuth.ts`, `koaSetup.ts`, `routes/moderation/` | Credentials in logs (#644); a route reachable without authentication | Key rotation required; log retention is not reversible |
| Khronos client bump | `@pluto-khronos/*` in `package.json`, `.github/workflows/khronos-client-update.yml` | A generated-client change alters request or response shapes and ships as a patch release with no human in the loop (#622, #680) | Revert makes another release |
| CI/CD | `.github/workflows/`, `Dockerfile` | A merge becomes a release PR, a published release, a GHCR `latest` and a Watchtower pull (#537, #595, #597, #629) | Re-point to the prior image tag; no auto-rollback |

## Checks

Interactions
- The first awaited call in every command, button, modal and select handler is `deferReply`, `deferUpdate` or `reply`. Awaited Khronos, Redis or Discord-fetch calls before the ack miss Discord's 3-second window.
- After a defer, every failure path ends in `editReply` or an ephemeral `followUp`. A `reply()` after a defer, and a `catch` that only logs, leave the user with a spinner.
- In bet placement and confirm flows, no `clearUserBet`, cache delete or state transition runs before the success message is built (`BetslipsManager.ts`, #607). Side effects after the money call are non-fatal or last.

Queue and Redis
- `jobId` stays `delivery_id`. Changes to attempts, backoff, concurrency, `lockDuration` or `removeOn*` are findings until justified. A new delivery kind passes failure-propagation and nonce options through every branch: won, lost, edit, DM (#605).
- Swallowed errors (`.catch(() => undefined)`, a `try/catch` around `sendEmbed`) on a path the queue relies on are findings.
- A `get` followed by `set` or `del` on a lock, lease or state key uses the atomic helpers in `redis-instance.ts` (`compareAndRemove`, `refreshIfOwned`, `transitionIfValue`; ADR 002). A stored value's encoding matches the value it is compared to (#578). The result of every lease refresh is acted on, not only its exceptions.
- Hardcoded durations that depend on each other (5-minute channel lease, 120s reservation, 30s drain, 45s `stop_grace_period`) change together or the PR explains why not (#609, #618).

Payload validation
- A tightened schema is checked against what Khronos actually sends (counts, enums); a loosened one has a bound. Snowflake checks are 17 to 20 digits.

Components V2
- Count components (container, rows, row children at most 40) and text (at most 4000 characters). Ephemeral goes through the `Ephemeral` flag. `allowedMentions` is explicit wherever a ping is intended. `customId` strings stay stable or are versioned. `attachment://` names equal the `files` names. A migrated file leaves the `cv2-guard` allowlist in the same PR. Errors and private data are ephemeral; bet announcements are public.

Permissions and logging
- A new route enforces authentication explicitly (`ctx.state.apiKeyAuthenticated` or the route's own auth), and path-prefix exemptions in `apiKeyAuth.ts` stay as narrow as they are. Permission lookups fail closed: only Discord error 10007 means "not a member" (#625).
- No header, token or payload is dumped through `logger`. A new credential header joins the redaction list in `koaSetup.ts` (#644).

Khronos client bump
- Both `@pluto-khronos/api-client` and `@pluto-khronos/types` move to the same version. Read the Khronos release notes for changed DTOs and confirm call sites using changed fields have tests.

Workflows and assets
- Trigger, `if:`, token source (`GITHUB_TOKEN` creates releases that never fire `release: published`; the App token does), concurrency and path filters are traced. Required checks always report (#629). Third-party actions in `pull_request_target` jobs are SHA-pinned.
- Every merged `fix`, `feat`, `deps`, `perf`, `refactor`, `revert`, `hotfix` or `patch` title ships a release.
- A change to `config/matchup-assets-release.json` matches the archive SHA in the PR body. A validator change never widens the `audit:` exemption in `validate-matchup-assets.mjs` (#682).

## Flags

`MAINTENANCE_MODE` gates only seven commands (bet, doubledown, cancelbet, odds, balance, dailyclaim, leaderboard); `mybets`, `parlay`, `predictions`, `stats` and `register` keep running. A diff that relies on it as a kill switch is a finding. `USE_MOCK_DATA` and `PLUTO_SYSTEM_MODE` must stay unreachable when `NODE_ENV=production`.

## Neighbours

The cross-service contract is `docs/architecture/cross-service-overview.md` in `fearandesire/khronos`.

- Khronos to Pluto: `POST` notifications are accepted into the `notification-delivery-v1` queue and answered 202 before Discord fanout. `delivery_id` is the durable identity. Changing acceptance rules changes what Khronos retries or marks dead.
- Pluto to Khronos: `placement_id` is a UUID generated by Pluto and stays stable across retries, so an ambiguous retry recovers the committed wager instead of debiting twice.
- Pluto-Docs describes commands and rules by hand. A change to a command's options, gating, economy numbers or supported markets names the doc page that needs the same edit.

## Leave to the toolchain

Formatting and lint rules are enforced by Biome; PR titles by the title check. A review comment on them adds noise.
