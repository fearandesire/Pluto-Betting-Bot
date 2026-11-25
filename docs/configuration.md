# Configuration reference

Pluto reads its configuration from environment variables. `src/lib/startup/env.ts` validates them with Zod at startup, and an invalid or missing required value stops the process before it connects to Discord. A few logging and telemetry variables are read straight from `process.env` and are listed separately below. `.env.example` is a starting point for local development; it carries placeholders only and never real values.

Boolean flags marked **flag** accept `true` or `1` as on. Any other value, including unset, is off. Two flags are the other way round and are on unless set to exactly `false`: `BIG_WIN_ANNOUNCEMENTS_ENABLED` and `RECAP_ENABLED`.

## Core

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | none | `development`, `production` or `test`. Production refuses `USE_MOCK_DATA` and the system-mode flags. |
| `TOKEN` | yes, unless system mode is active | none | Discord bot token. |
| `PREFIX` | yes | none | Legacy message-command prefix. |
| `PROJECT_VERSION` | no | package version | Ignored if set. Pluto always reports `v` plus the `package.json` version in logs and the startup banner. |
| `APP_OWNER_ID` | yes | none | Discord user id for owner-only commands such as `/footer-config`. |
| `LOG_LEVEL` | no | `Info` | `Trace`, `Debug`, `Info`, `Warn`, `Error` or `Fatal`. |

## Khronos and the HTTP API

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `KH_API_URL` | yes | none | Khronos base URL. Every Khronos call carries an `X-Request-ID` header. |
| `KH_API_TOKEN` | yes | none | Khronos API credential. |
| `KH_PLUTO_CLIENT_KEY` | yes | none | Khronos client key for Pluto. |
| `API_PORT` | no | `2090` | Port of Pluto's Koa API. The older name `APIPORT` is still read when `API_PORT` is unset. |
| `API_URL` | yes | none | Public URL of Pluto's API. |
| `API_KEY` | yes | none | Key that services send as `X-API-Key` (or `apiKey`) to Pluto's API. |
| `BULL_BOARD_USERNAME`, `BULL_BOARD_PASSWORD` | yes | none | Credentials for the queue dashboard. |

## Redis

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `R_HOST` | yes | none | Redis host. |
| `R_PORT` | no | `6379` | Redis port. |
| `R_DB` | no | `0` | Redis database index. |
| `R_PASS` | yes | none | Redis password. |

## Observability

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AXIOM_DATASET`, `AXIOM_API_TOKEN`, `AXIOM_ORG_ID` | yes, unless `USE_MOCK_DATA` is on | none | Hosted log shipping credentials. |
| `LOKI_URL`, `LOKI_USER`, `LOKI_PASS` | no | blank | Legacy direct log push. Logs are normally collected from the container's stdout. |
| `BETTING_OPS_WEBHOOK_URL` | no | unset | Discord webhook for betting ops alerts. Unset or blank disables them; any other value must be a URL. The URL is never logged. See [Betting ops alerts](features/betting-ops-alerts.md). |

Read directly from `process.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PLUTO_OTEL_ENABLED` | off | Tracing runs only when this is exactly `true`. When it is off, no OpenTelemetry SDK loads. When it is on, spans export over OTLP gRPC and Redis spans keep only the command name. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` and other standard `OTEL_*` variables | exporter defaults | Read by the OTLP exporter. |
| `OTEL_SERVICE_NAME` | `pluto` | Trace service name. |
| `LOG_FORMAT` | by `NODE_ENV` | `pretty` or `json` console output. Unset means pretty outside production and JSON in production. |
| `APP_NAME`, then `SERVICE_NAME` | `PLUTO-DISCORD` | The `app` field on log lines. |

## Feature flags

| Flag | Default | When on | When off | Depends on |
| --- | --- | --- | --- | --- |
| `MAINTENANCE_MODE` (**flag**) | off | `/balance`, `/dailyclaim`, `/bet`, `/cancelbet`, `/doubledown`, `/leaderboard` and `/odds` reply with a maintenance notice instead of running. | Commands run normally. | Nothing. |
| `PROFILE_ENABLED` (**flag**) | off | Registers `/profile` and `/achievements` and lists them in help. | Neither command is registered. | The Khronos achievements API. `.env.example` says to leave it off until that API is deployed. |
| `PROFILE_VIEWS_ENABLED` (**flag**) | off | `/profile` shows the Components V2 Headline and Trophy Shelf views instead of the profile image. | `/profile` shows the image card. | `PROFILE_ENABLED`. |
| `STATS_PROPS_ENABLED` (**flag**) | off | Registers `/stats props`, a user's prop prediction hit rate with an optional sport filter. | The subcommand is not registered, and a stale registration answers "Prop stats are not available yet." | Khronos `GET /stats/props/:userId`. `.env.example` says to leave it off until that endpoint is deployed. |
| `BIG_WIN_ANNOUNCEMENTS_ENABLED` | on | Wins with a payout at or above `ANNOUNCE_PAYOUT_THRESHOLD` are announced in the guild's betting channel, at most `ANNOUNCE_MAX_PER_HOUR` per guild in a rolling hour shared by all replicas. | No announcements. Only `false` turns it off. | Redis. |
| `RECAP_ENABLED` | on | Starts the weekly recap scheduler. | No scheduled recap. Only `false` turns it off. | Khronos recap API. See [Recaps and leaderboard posts](features/recaps-and-leaderboards.md). |
| `RECAP_NBA_ENABLED` (**flag**) | off | Adds NBA to the env-configured weekly recap and to period-winner posts. | NFL only. | `RECAP_ENABLED` or `PERIOD_WINNERS_ENABLED`. |
| `PERIOD_WINNERS_ENABLED` (**flag**) | off | Posts weekly and monthly winners to `RECAP_GUILD_IDS`. | No period-winner posts. | At least one guild in `RECAP_GUILD_IDS` (or `GUILD_ID`). |
| `PLUTO_OTEL_ENABLED` | off | See Observability. | No tracing. | An OTLP endpoint. |
| `USE_MOCK_DATA` (**flag**) | off | Local development mode: in-memory cache, no Redis-backed startup services, no recap or period-winner schedulers, and `PATREON_API_URL` and the `AXIOM_*` variables become optional. | Normal operation. | `MOCK_GUILD_BETTING_CHAN_ID` and `DEV_GUILD_GAMES_CATEGORY_ID`. Refused when `NODE_ENV=production`. |
| `PLUTO_SYSTEM_MODE` and `PLUTO_SYSTEM_ALLOW` (**flags**) | off | Hermetic system-test boot: `TOKEN` becomes optional and deliveries go to a fake Discord dispatcher. | Normal boot. | Both must be on together, and `NODE_ENV` must not be `production`. |

## Feature settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `MOCK_GUILD_BETTING_CHAN_ID` | none | Betting channel for mock mode. Required when `USE_MOCK_DATA` is on. |
| `DEV_GUILD_GAMES_CATEGORY_ID` | none | Category for dev game channels. Required when `USE_MOCK_DATA` is on. |
| `MOCK_GUILD_SPORT` | `nba` | `nba` or `nfl` for mock mode. |
| `PATREON_API_URL` | none | Supporter API. Required unless `USE_MOCK_DATA` is on. |
| `ANNOUNCE_PAYOUT_THRESHOLD` | `100` | Minimum payout for a big-win announcement. |
| `ANNOUNCE_MAX_PER_HOUR` | `5` | Big-win announcements per guild per rolling hour. |
| `RECAP_CRON` | `0 9 * * 1` | Weekly recap schedule, five fields, matched in UTC. |
| `RECAP_GUILD_IDS` | `GUILD_ID`, else blank | Comma-separated guilds for the env-configured recap and for period winners. |
| `RECAP_CHANNEL_ID` | unset | Recap channel for the env-configured path. Unset posts to the guild's betting channel. |
| `PERIOD_WINNERS_WEEKLY_CRON` | `30 9 * * 1` | Weekly winners schedule (UTC). |
| `PERIOD_WINNERS_MONTHLY_CRON` | `30 9 1 * *` | Monthly winners schedule (UTC). |

## Test-only variables

CI sets `PLUTO_REQUIRE_REDIS_TESTS=1` and `PLUTO_TEST_REDIS_URL` so the Redis contract tests run against a real Redis instead of skipping. `PLUTO_SHARED_CONTRACT_MODULE` points one contract test at a shared contract module and skips it when unset.

## Guild settings stored in Khronos

Some behaviour is configured per guild rather than per process. These settings live in Khronos and are read at run time, so changes need no restart.

| Setting | Set with | Effect |
| --- | --- | --- |
| `PROPS_ENABLED` and the predictions channel | `/props enable` and `/props disable` | Whether the guild receives daily props, and where. A missing `PROPS_ENABLED` row means enabled. |
| Props strategy | `/props strategy` | `default` or `smart`. See [Player props](features/props.md). |
| `LOGS_ENABLED` | `/config set` | Only `false` stops posts to the guild's log channel. A missing row or any other value keeps them on. |
| Recap settings (`guild_recap_settings`) | Khronos staff tooling | Weekly recap target, NBA inclusion, and the weekly and monthly leaderboard auto-posts. |
