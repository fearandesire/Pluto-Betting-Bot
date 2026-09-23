# Components V2 migration

Pluto's classic embed messages are moving to Discord **Components V2**. This folder is the single source of truth for that work. It holds the per-surface checklist, the surface table, and the before/after screens every PR must include.

- **Kit:** `src/lib/discord/v2/` — `kit.ts` (payload + blocks), `edit.ts` (classic→V2 edits), `notice.ts` (V2-aware errors), `paginator.ts`
- **Screens:** `screens/<cluster>/<ID>-{before,after}.{json,png}` plus `<ID>.gif` (before→after)
- **Pipeline:**
  ```bash
  CV2_DUMP=after CV2_CLUSTER=<cluster> pnpm vitest run scripts/cv2/dump-surfaces.test.ts
  scripts/cv2/render.sh <cluster>   # needs ../discord-preview (bun) + ffmpeg
  ```
  Each surface's fixture is in `scripts/cv2/fixtures/cluster-<cluster>.ts`. A cluster PR adds an `after` function next to the existing `before`.
- **Guard:** `src/test/cv2-guard.test.ts` fails when a file not on its allowlist uses `EmbedBuilder`, `embeds:`, or `PaginatedMessageEmbedFields`. Each cluster PR removes its own files from the allowlist.

## Per-surface checklist

A cluster PR is done when every box is ticked for each surface ID it owns, and the `cv2-surface-reviewer` agent reports PASS.

- [ ] The builder is pure, lives under `src/lib/discord/`, and uses only kit helpers.
- [ ] The test uses `expectV2Payload` with the **exact** flags and component count, plus one worst-case-length fixture.
- [ ] Defers pass only `Ephemeral` (or nothing). Edits use `v2EditFlags()`.
- [ ] The whole edit chain goes V2 in the same PR. Updates rebuild the full container and never read `message.components` as ActionRows.
- [ ] Recoverable errors call `deferUpdate` and send an ephemeral `followUp` (via `sendErrorNotice`). End states send the full payload.
- [ ] Messages that might predate the deploy are edited with `isV2Message` → `editMessageToV2`, or the legacy branch is logged below.
- [ ] Custom IDs are unchanged, or a versioned codec plus a "please re-run" reply covers the old IDs.
- [ ] `allowedMentions` is opted in explicitly wherever a ping is intended.
- [ ] Images use `attachment://` names that match `files`.
- [ ] `pnpm typecheck && pnpm test:run` passes, and the surface's files are removed from the guard allowlist.
- [ ] The `after` dump and render are done, the GIF exists, and the PR body has its row (template below).
- [ ] Live smoke in the dev guild (Fenix): initial send, each edit in the chain, one forced error, and a pre-deploy message where one applies.
- [ ] Any new pitfall is added to the `discord-builders` skill.

### PR body template

Images must use SHA-pinned raw URLs; relative paths don't render in PR bodies, and branch URLs break once the branch is deleted.

```md
## Visual verification
| ID | Surface | Before | After | Live |
|---|---|---|---|---|
| A1 | Pending betslip | ![](https://github.com/fearandesire/Pluto-Betting-Bot/raw/<sha>/docs/components-v2/screens/betting/A1-before.png) | ![](…/A1-after.png) | ![](…/A1-live.png) |

<details><summary>Before → After</summary>

![A1](…/betting/A1.gif)
</details>
```

## Surface table

Status: ⬜ todo · 📸 before captured · 🔁 migrated (after + GIF) · ✅ merged + live-verified · ⏸ holdout

| ID | Surface | Cluster | Source | PR | Status |
|---|---|---|---|---|---|
| A1 | Pending betslip | betting | `BetslipsManager.presentBetWithPay` | | 📸 |
| A2 | Bet confirmed | betting | `BetslipsManager.successfulBetEmbed` | | 📸 |
| A3 | placeBet failure | betting | `BetslipsManager.placeBet` | | 📸 |
| A4 | Bet cancelled | betting | `ButtonListener` cancel | | 📸 |
| A5 | Confirm failure | betting | `ButtonListener` confirm | | 📸 |
| A6 | Public "placed a bet" | betting | `BetslipsManager` | | 📸 |
| A7 | Public parlay placed | betting | `BetslipsManager.announceParlayPlaced` | | 📸 |
| A8 | /cancelbet | betting | `BetslipsManager.cancelBet` | | 📸 |
| A9 | /doubledown | betting | `commands/betting/doubledown.ts` | | 📸 |
| A10 | /mybets | betting | `mybets-formatter.service.buildEmbedResponse` | | 📸 |
| A11 | MyBets page / cancel | betting | `my-bets-pagination-handler`, `parlay-cancel-handler` | | 📸 |
| A12 | /parlay builder | betting | `ParlayBuilderService.render` | — | already V2 |
| B1 | /odds board | odds | `parseScheduled` | | 📸 |
| B2 | Daily schedule | odds | `GameSchedule` | | 📸 |
| B3 | Game-channel post | odds | `ChannelManager.prepareGameMessage` | | 📸 |
| C1 | Prop post | props | `PropPostingHandler` | | 📸 |
| C2 | Prop settlement edit | props | `notifications.service.buildPropSettlementEmbed` | | 📸 |
| C3 | Prediction placed | props | `ButtonListener` prop branch | | 📸 |
| C5 | /predictions history | props | `predictions.ts` | | 📸 |
| C6 | /predictions stats | props | `predictions.ts` | | 📸 |
| C7 | /predictions leaderboard | props | `predictions.ts` + `pagination.ts` | | 📸 |
| C8 | Deprecated prediction aliases | props | `prediction-deprecation.ts` | | 📸 |
| D1 | /balance | account | `requests/accounts/AccountManager` | | 📸 |
| D2 | /dailyclaim | account | same | | 📸 |
| D3 | /register | account | `Khronos/accounts/AccountManager` | | 📸 |
| D4 | /leaderboard | account | `pagination-utilities.ts` | | 📸 |
| D5 | /stats h2h | account | `commands/stats/stats.ts` | | 📸 |
| D6 | Welcome DM | account | `WelcomeMessageService` | | 📸 |
| E1 | Bet result DM | notifications | `notifications.service.notifyUser` | | 📸 |
| E2 | Parlay result DMs | notifications | `notifications.service.buildParlayEmbeds` | | 📸 |
| E3 | Big-win announcement | notifications | `BigWinAnnouncementService` | | 📸 |
| E4 | Weekly recap | notifications | `weekly-recap.embed.ts` | | 📸 |
| F1 | /config footer (admin) | admin | `commands/admin/config.ts` | | 📸 |
| F2 | /config set/view | admin | `commands/configuration/config.ts` | | 📸 |
| F3 | /admin predictions view | admin | `admin-predictions-handler.ts` | | 📸 |
| F4 | /admin predictions delete | admin | same | | 📸 |
| F5 | /admin props generate | admin | `admin-props-handler.ts` | | 📸 |
| F6 | /admin props viewactive | admin | same | | 📸 |
| F7 | AppLog log embed | admin | `AppLog.ts` | | 📸 |
| F8 | Command-error log | admin | `chatInputCommandError.ts` | | 📸 |
| G1 | /help, /faq, /commands | help | `lib/discord/builders/info.ts` | | 📸 |
| G2 | /patreon | help | `commands/info/patreon.ts` | | 📸 |
| G3 | /changelog | help | `commands/info/changelog.ts` | | 📸 |
| G4–G6 | Error notices | — | `lib/discord/v2/notice.ts` | PR 0 | V2-aware |
| G7 | Precondition denied | — | content only | — | no change |

## Holdouts (stay classic, on purpose)

| What | Why | Revisit when |
|---|---|---|
| C4/C9 prop stats (`props-stats.ts`, `PropsController`, `PropsPresentation`, `PropEmbedManager`) | `POST /props/stats/post-start` is a disabled feature (early return, body commented out) | The feature is re-enabled; migrate it then, or delete the feature |
| `ErrorEmbeds` factory | Classic targets still use it; `sendErrorNotice` converts it on V2 targets | Every surface is V2 |

## Legacy branches (dual-format code to delete later)

| Where | Branch | Delete when |
|---|---|---|
| C2 prop settlement | `isV2Message(original)` ? rebuild from ledger : legacy embed rebuild | No unsettled props posted before the C cluster deploy remain in the ledger |
| B3 game-channel dedupe | matches TextDisplay content **or** legacy `embed.description` | One full season after the B cluster deploy |

## Carry-overs for cluster PRs (found during before-capture)

| Cluster | Item |
|---|---|
| admin | F3/F6: Sapphire paginator gets the template as the message template, not via `setTemplate`, so every page has a **random colour** in production. The V2 paginator fixes this; confirm in the live smoke. |
| admin | F8: `lib/discord/builders/admin-command-error.ts` duplicates the inline embed in `chatInputCommandError.ts` (listener was frozen in PR 0). Point the listener at the builder, then migrate. |
| admin | F6: fixture uses midday-UTC dates. If production sends date-only `YYYY-MM-DD`, `toLocaleDateString` can show the previous day in US timezones. Check it. |
| all (paginator) | `v2-pagination-handler` `ownerOnly` compares against `message.interactionMetadata.user`, which is null on `channel.send` messages. Only use `ownerOnly` for command replies, or store the owner in the scope. |
| betting | A3: only the non-2xx failure message is captured; the catch-branch text differs. |
| all | Production has no `TZ` (UTC). Times formatted with local time (e.g. C1 "Game Time", MyBets date headers) show **UTC** to users, which is an existing bug. V2 builders should use Discord timestamps (`<t:unix:f>` / `<t:unix:R>`) so each viewer sees their own time zone. |

## Known render limits

- Remote images come from `scripts/cv2/fixtures/images/`. The Pluto logo is real (imgbb); the guild icon and match image are labelled placeholders.
- `-#` subtext draws literally, and markdown/newlines inside embed **field values** show as raw text, until discord-preview supports them. The JSON is correct and Discord renders it properly. Once the renderer is fixed, re-run `render.sh` on the existing JSON; no re-dump needed.
- Guild custom emojis don't exist offline, so team names use each code path's no-emoji fallback.
- Dates render in UTC (pinned in the dump harness to match production).
