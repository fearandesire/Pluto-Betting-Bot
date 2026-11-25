# Recaps and leaderboard posts

Pluto posts three kinds of scheduled summary: the weekly recap, weekly and monthly period winners, and the weekly and monthly props leaderboard. Each scheduler matches its five-field cron in UTC, runs once per matching slot, and catches up a missed run when the bot restarts later on the scheduled day.

## Weekly recap

`RECAP_ENABLED` (on unless `false`) starts the scheduler on `RECAP_CRON` (default Monday 09:00 UTC). It does not start when `USE_MOCK_DATA` is on. Each run covers the previous week, and an NFL recap requests NFL results only.

Targets are re-read from Khronos recap settings on every run, so changes need no restart:

- When Khronos has at least one recap settings row, only rows that are enabled and have a channel are posted, and each row's `nba_enabled` decides whether NBA is included. A guild without a row gets nothing.
- When Khronos has no rows, or the settings read fails, Pluto falls back to `RECAP_GUILD_IDS` (or `GUILD_ID`), `RECAP_CHANNEL_ID` and `RECAP_NBA_ENABLED`.

## Period winners

`PERIOD_WINNERS_ENABLED` (off by default) posts weekly winners on `PERIOD_WINNERS_WEEKLY_CRON` and monthly winners on `PERIOD_WINNERS_MONTHLY_CRON` to `RECAP_GUILD_IDS`. NFL is always included and NBA only with `RECAP_NBA_ENABLED`. It does not start with `USE_MOCK_DATA` on or with no guilds configured.

## Leaderboard auto-posts

The props prediction leaderboard for the current US Eastern week or month is posted to every guild whose Khronos recap settings enable `weekly_leaderboard_enabled` or `monthly_leaderboard_enabled` and have a channel. The weekly post runs Sunday at 23:00 UTC. The monthly cron fires at 23:00 UTC on days 28 to 31, and the post goes out only on the last Eastern day of the month. There is no environment fallback for these posts, and a failed settings read skips the run.

## Manual posts

- `/recap post type:<weekly|monthly> [sport:<nfl|nba>]` posts a recap to the current guild now. It needs Manage Server by default and defaults to NFL. It posts to the guild's saved recap channel, or to the channel where the command ran.
- `POST /recap/post` lets Khronos trigger the same post. The body is `guild_id`, `channel_id`, `type` (`weekly` or `monthly`) and an optional `sport` (default `nfl`). It needs the service API key and answers `200` with `channel_id` and `message_id`, `401` without a key, `422` for an invalid body and `502` when posting fails.

A `monthly` post is the period-winners message for that month.

## Leaderboard command

`/predictions leaderboard` takes an optional `period` (`week` for Monday to Sunday, `month` or `all`, in US Eastern time) and an optional `type` (`props`, `games` or `all`). Both default to all.
