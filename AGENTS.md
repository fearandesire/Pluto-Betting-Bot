# AGENTS.md

Guidance for AI coding agents and human contributors working in this repository. `CLAUDE.md` imports this file, so Claude Code, Codex, Cursor and other agents read the same rules.

Pluto is the open-source Discord client for a virtual sports betting platform. It renders commands, buttons and notifications in Discord. The backend API (Khronos) is private, and Pluto reaches it only through the published `@pluto-khronos/api-client` and `@pluto-khronos/types` packages.

## Build, test and lint

Use Node.js 22 or newer and pnpm 10. Run every command from the repository root.

```bash
pnpm install          # install dependencies
pnpm typecheck        # tsc --noEmit
pnpm test:run         # vitest, single run
pnpm build            # swc build, then verify:runtime on the compiled output
pnpm lint             # biome check --write --unsafe . (rewrites files)
pnpm exec biome ci .  # read-only Biome check
```

Run one test file with `pnpm vitest run src/lib/discord/v2/__tests__/kit.test.ts`. Tests pin `TZ=UTC` in `vitest.config.ts`, so date output matches on every machine.

Before you open a pull request, run `pnpm typecheck`, `pnpm test:run` and `pnpm build`. The pre-commit hook runs `lint-staged` (Biome on staged files) and refuses to commit while `yalc.lock` exists.

## Run it locally without secrets

Typecheck, tests, build and the Components V2 screen dumps need no `.env` file and no credentials. That covers most changes.

To start the bot itself, you need your own Discord application and a Redis instance:

1. Copy `.env.example` to `.env`.
2. Set `TOKEN` to your own test bot's token, and point `R_HOST`, `R_PORT` and `R_PASS` at your Redis.
3. Keep `USE_MOCK_DATA=true` and set `MOCK_GUILD_BETTING_CHAN_ID` and `DEV_GUILD_GAMES_CATEGORY_ID` to a channel and a category in your own test server.
4. Run `pnpm dev`.

Leave the other placeholders as they are, because they pass startup validation. Commands that call the backend API fail without a compatible server. Startup validation in `src/lib/startup/env.ts` refuses `USE_MOCK_DATA` and `PLUTO_SYSTEM_MODE` when `NODE_ENV=production`.

Never use production tokens, guilds or channels for local runs, and never post test messages in a public server.

## Code layout

| Path | Holds |
| --- | --- |
| `src/commands/` | Sapphire slash commands, grouped by area |
| `src/interaction-handlers/` | Button, modal, select and autocomplete handlers |
| `src/listeners/` | Sapphire event listeners |
| `src/preconditions/` | Command preconditions |
| `src/lib/discord/builders/` | Pure functions that build message payloads |
| `src/lib/discord/v2/` | The Components V2 kit: `kit.ts`, `edit.ts`, `notice.ts`, `paginator.ts` |
| `src/services/` | Stateful features such as the parlay builder and alerts |
| `src/utils/api/` | Backend API wrappers and the inbound Koa API |
| `scripts/cv2/` | Fixtures and the dump test for Components V2 screens |
| `docs/` | Architecture decisions, feature guides and the Components V2 guide |

## Code conventions

- Biome formats the code. It uses tabs, single quotes, no semicolons, trailing commas and an 80-column line. Do not hand-format.
- The project is ESM. Local imports use an explicit `.js` extension. Use the `#lib/*` and `@pluto-config` aliases from `tsconfig.json`, and do not rewrite package subpaths to filesystem paths.
- Tests live next to the code in `__tests__/` folders and run on Vitest. Assert what a user or caller sees, such as the payload JSON or the reply text, not private helpers.
- Keep payload builders pure. A builder takes data and returns a payload. The command or handler does the I/O.
- Log through `src/utils/logging/WinstonLogger.ts`. Never log headers, tokens or full request payloads.
- Every command, button, modal and select handler acknowledges first, with `deferReply`, `deferUpdate`, `reply` or `showModal`. Discord fails any interaction that is not acknowledged within 3 seconds.
- After a defer, every failure path ends in `editReply` or an ephemeral `followUp`. A `catch` that only logs leaves the user on a spinner.
- Only `game-channel-topic.ts` writes game channel topics. `CONTRIBUTING.md` has the rule and the test that enforces it.

## Components V2 rules

New and changed Discord messages use Components V2. The full guide is `docs/components-v2/README.md`. These rules are the minimum:

- Build messages with `v2Payload()` and the helpers in `src/lib/discord/v2/kit.ts`. It sets the `IsComponentsV2` flag, clamps text to 4000 characters, caps the message at 40 components and turns mentions off.
- Do not add `EmbedBuilder` or `embeds:` to a file that is not on the allowlist in `src/test/cv2-guard.test.ts`. When you migrate a file, remove it from the allowlist in the same pull request.
- Make a reply private with `ephemeral: true` on `v2Payload()` or `flags: MessageFlags.Ephemeral` on the defer. Pass `v2EditFlags()` on `editReply`, because Discord rejects the ephemeral flag on edits.
- Use a versioned `customId` codec, such as `profile.v1.share.<owner>.<target>`. Never change the format of an ID that live messages still carry. Bump the version and answer the old ID with a "run the command again" reply.
- Show an error on a V2 message with `sendErrorNotice()` from `notice.ts`. Editing a V2 message with `embeds` is a Discord 400 error.
- Name every `attachment://` URL exactly like a file in `files`.
- Render previews of every changed screen before review.

## Reviewing

`REVIEW.md` maps paths to their blast radius and lists the checks for each area. Read it before you review a pull request or change a hot path.

## Pull requests

- Branch from `main`. Pull request titles follow Conventional Commits, and `.github/workflows/pr-title.yml` lists the allowed types.
- Fill in `.github/PULL_REQUEST_TEMPLATE.md`. Changes users can see need a screenshot.
- Keep one concern per pull request.

## What is public and what is private

This repository is public. Everything you commit, and every pull request, issue and comment, is public.

- Commit only what an outside contributor can use: code, tests, public docs and placeholder configuration.
- Keep these out of tracked files: tokens and keys, real guild, channel and user IDs, hostnames and IP addresses, secret-manager project or config names, observability stack names, deploy and release runbooks, and the contents of private repositories.
- Keep private notes in files that git ignores: `AGENTS.local.md`, `CLAUDE.local.md`, `.claude/` and `docs/agents/`.
- If you are not sure whether something is public, leave it out and ask a maintainer.
