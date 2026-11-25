# Configuration reference

Pluto reads its configuration from environment variables. `src/lib/startup/env.ts` validates them with Zod at startup, and an invalid or missing required value stops the process at startup. This page covers runtime configuration and a few test controls; other test-only switches live in the tests that read them. A few logging and telemetry variables are read straight from `process.env` and are listed separately below. `.env.example` is a starting point for local development; it carries placeholders only and never real values.

Boolean flags marked **flag** accept `true` or `1` as on. Any other value, including unset, is off. Two flags are the other way round and are on unless set to exactly `false`: `BIG_WIN_ANNOUNCEMENTS_ENABLED` and `RECAP_ENABLED`. Set `USE_MOCK_DATA` to `true` rather than `1`: startup accepts both, but the parlay mocks are selected only by the literal value `true`.

## Core

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | none | `development`, `production` or `test`. Production refuses `USE_MOCK_DATA` and the system-mode flags. |
| `TOKEN` | yes, unless system mode is active | none | Discord bot token. |
| `PREFIX` | yes | none | Validated at startup but unused: message commands are disabled. |
| `PROJECT_VERSION` | no | package version | Ignored if set. Pluto always reports `v` plus the `package.json` version in logs and the startup banner. |
| `APP_OWNER_ID` | yes | none | Discord user id for owner-only commands such as `/footer-config`. |
| `LOG_LEVEL` | no | `Info` | `Trace`, `Debug`, `Info`, `Warn`, `Error` or `Fatal`. |

## Khronos and the HTTP API

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `KH_API_URL` | yes | none | Khronos base URL. Every Khronos call carries an `X-Request-ID` header. |
| `KH_API_TOKEN` | yes | none | Validated at startup. Pluto's Khronos calls authenticate with `KH_PLUTO_CLIENT_KEY`, not this value. |
| `KH_PLUTO_CLIENT_KEY` | yes | none | Key Pluto sends to Khronos as `x-api-key`. |
| `API_PORT` | no | `2090` | Port of Pluto's Koa API. The older name `APIPORT` is still read when `API_PORT` is unset. |
| `API_URL` | yes | none | Validated at startup but not used to bind or address the API; the Koa server listens on `API_PORT`. |
| `API_KEY` | yes | none | Key that services send in the `X-API-Key` header to Pluto's API. A legacy `apiKey` query parameter is also accepted, but request URLs are logged before authentication, so it can expose the key in logs. Use the header. |
| `BULL_BOARD_USERNAME`, `BULL_BOARD_PASSWORD` | yes | none | Credentials for the queue dashboard. |

## Redis

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `R_HOST` | yes | none | Redis host. |
| `R_PORT` | no | `6379` (parser default) | Redis port. |
| `R_DB` | no | `0` (parser default) | Redis database index for the cache client. The queue connection does not pass it. |
| `R_PASS` | yes | none | Redis password. |

The defaults above come from the startup parser, but the cache client reads the raw values, so an unset `R_PORT` or `R_DB` does not reliably reach it as the default. Set both explicitly.

## Observability

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AXIOM_DATASET`, `AXIOM_API_TOKEN`, `AXIOM_ORG_ID` | yes, unless `USE_MOCK_DATA` is on | none | Validated at startup but not wired: the logger writes to the console only. |
| `LOKI_URL`, `LOKI_USER`, `LOKI_PASS` | no | blank | Legacy and not wired. Logs are collected from the container's stdout. |
| `BETTING_OPS_WEBHOOK_URL` | no | unset | Discord webhook for betting ops alerts. Unset or blank disables them; any other value must be a URL. Use a staff-only channel. The alert sender never logs the URL. See [Betting ops alerts](features/betting-ops-alerts.md). |

Read directly from `process.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PLUTO_OTEL_ENABLED` | off | Tracing runs only when this is exactly `true`. When it is off, no OpenTelemetry SDK loads. When it is on, spans export over OTLP gRPC and Redis spans keep only the command name. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` and other standard `OTEL_*` variables | exporter defaults | Read by the OTLP exporter. |
| `OTEL_SERVICE_NAME` | `pluto` | Trace service name. |
| `LOG_FORMAT` | by `NODE_ENV` | `pretty` or `json` console output. Unset means pretty outside production and JSON in production. |
| `APP_NAME`, then `SERVICE_NAME` | `PLUTO-DISCORD` | The `app` field on JSON log lines. Pretty output leaves it out. |

## Feature flags

| Flag | Default | When on | When off | Depends on |
| --- | --- | --- | --- | --- |
| `MAINTENANCE_MODE` (**flag**) | off | `/balance`, `/dailyclaim`, `/bet`, `/cancelbet`, `/doubledown`, `/leaderboard` and `/odds` reply with a maintenance notice instead of running. | Commands run normally. | Nothing. |
| `PROFILE_ENABLED` (**flag**) | off | Registers `/profile` and `/achievements` and lists them in help. | Neither command is registered. | The Khronos achievements API. `.env.example` says to leave it off until that API is deployed. |
| `PROFILE_VIEWS_ENABLED` (**flag**) | off | `/profile` shows the Components V2 Headline and Trophy Shelf views instead of the profile image. | `/profile` shows the image card. | `PROFILE_ENABLED`. |
| `STATS_PROPS_ENABLED` (**flag**) | off | Registers `/stats props`, a user's prop prediction hit rate with an optional sport filter. | The subcommand is not registered, and a stale registration answers "Prop stats are not available yet." | Khronos `GET /stats/props/:userId`. `.env.example` says to leave it off until that endpoint is deployed. |
| `BIG_WIN_ANNOUNCEMENTS_ENABLED` | on | Wins with a payout at or above `ANNOUNCE_PAYOUT_THRESHOLD` are announced in the guild's betting channel, at most `ANNOUNCE_MAX_PER_HOUR` per guild in a one-hour window that starts at the first announcement and is shared by replicas using the same Redis. | No announcements. Only `false` turns it off. | Redis. |
| `RECAP_ENABLED` | on | Starts the weekly recap scheduler. It does not affect period winners or leaderboard posts. | No scheduled weekly recap. Only `false` turns it off. | Khronos recap API. See [Recaps and leaderboard posts](features/recaps-and-leaderboards.md). |
| `RECAP_NBA_ENABLED` (**flag**) | off | Adds NBA to period-winner posts and to the weekly recap when it falls back to environment targets. A Khronos recap settings row's own NBA setting overrides it for that guild. | NFL only on those paths. | `RECAP_ENABLED` or `PERIOD_WINNERS_ENABLED`. |
| `PERIOD_WINNERS_ENABLED` (**flag**) | off | Posts weekly and monthly winners to `RECAP_GUILD_IDS`, in `RECAP_CHANNEL_ID` when set. | No period-winner posts. | At least one guild in `RECAP_GUILD_IDS` (or `GUILD_ID`) and the Khronos period-winners API. |
| `PLUTO_OTEL_ENABLED` | off | See Observability. | No tracing. | An OTLP endpoint. |
| `USE_MOCK_DATA` (**flag**, use `true`) | off | Local development mode: in-memory cache, no Redis-backed startup services unless system mode is also on, no recap or period-winner schedulers, and `PATREON_API_URL` and the `AXIOM_*` variables become optional. | Normal operation. | `MOCK_GUILD_BETTING_CHAN_ID` and `DEV_GUILD_GAMES_CATEGORY_ID`. Refused when `NODE_ENV=production`. |
| `PLUTO_SYSTEM_MODE` and `PLUTO_SYSTEM_ALLOW` (**flags**) | off | Hermetic system-test boot: `TOKEN` becomes optional, Pluto skips the Discord gateway login, and deliveries go to a fake Discord dispatcher. Redis-backed startup services still run, even with `USE_MOCK_DATA` on. | Normal boot. | Both must be on together, and `NODE_ENV` must not be `production`. |

## Feature settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `MOCK_GUILD_BETTING_CHAN_ID` | none | Betting channel for mock mode. Required when `USE_MOCK_DATA` is on. |
| `DEV_GUILD_GAMES_CATEGORY_ID` | none | Category for dev game channels. Required when `USE_MOCK_DATA` is on. |
| `MOCK_GUILD_SPORT` | `nba` | `nba` or `nfl` for mock mode. |
| `PATREON_API_URL` | none | Supporter API. Required unless `USE_MOCK_DATA` is on. |
| `ANNOUNCE_PAYOUT_THRESHOLD` | `100` | Minimum payout for a big-win announcement. |
| `ANNOUNCE_MAX_PER_HOUR` | `5` | Big-win announcements per guild per one-hour window. |
| `RECAP_CRON` | `0 9 * * 1` | Weekly recap schedule, five fields, matched in UTC. |
| `RECAP_GUILD_IDS` | `GUILD_ID`, else blank | Comma-separated guilds for period winners and for the weekly recap's environment fallback. |
| `RECAP_CHANNEL_ID` | unset | Channel for period winners and for the weekly recap's environment fallback. Unset posts to the guild's betting channel. |
| `PERIOD_WINNERS_WEEKLY_CRON` | `30 9 * * 1` | Weekly winners schedule (UTC). |
| `PERIOD_WINNERS_MONTHLY_CRON` | `30 9 1 * *` | Monthly winners schedule (UTC). |

An invalid value in any of the three cron variables disables that scheduler and logs an error; it does not stop startup.

## Test-only variables

The deployment workflow's test job sets `PLUTO_REQUIRE_REDIS_TESTS=1` and `PLUTO_TEST_REDIS_URL` so the Redis contract tests run against a real Redis. Setting `PLUTO_TEST_REDIS_URL` alone enables them; without it they skip. `PLUTO_REQUIRE_REDIS_TESTS=1` turns a missing URL into a test failure instead of a skip. `PLUTO_SHARED_CONTRACT_MODULE` points one contract test at a shared contract module and skips it when unset.

## Guild settings stored in Khronos

Some behaviour is configured per guild rather than per process. These settings live in Khronos and are read at run time, so changes need no restart.

| Setting | Set with | Effect |
| --- | --- | --- |
| `PROPS_ENABLED` and the predictions channel | `/props enable` and `/props disable` | Whether the guild receives daily props, and where. With no predictions channel the guild is not set up; with a channel, a missing `PROPS_ENABLED` row means enabled. Khronos's own props scheduler settings, such as the post time, are separate. |
| Props strategy | `/props strategy` | `default` or `smart`. See [Player props](features/props.md). |
| `LOGS_ENABLED` | `/config set` | Only `false` stops posts to the guild's log channel. A missing row or any other value keeps them on, but posts also need a valid log channel configured for the guild. |
| Recap settings (`guild_recap_settings`) | Khronos staff tooling | Weekly recap target and NBA inclusion (overriding the environment fallback when rows exist), and the weekly and monthly leaderboard auto-posts. |
