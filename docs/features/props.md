# Player props

Khronos selects the day's player props and asks Pluto to post them. Pluto posts each prop to the guild's props channel, records a receipt per outcome, and edits tracked messages when the prop settles. Guild admins control whether and how their server receives props.

## Server commands

`/props` needs the Administrator permission by default and runs only in a server. Every reply is private.

| Subcommand | What it does |
| --- | --- |
| `/props enable channel:<text channel>` | Checks that Pluto can View Channel, Send Messages, Embed Links and Read Message History in the channel, turns posting off, saves the channel as the guild's predictions channel, then sets `PROPS_ENABLED` to true. Posting stays off until the channel save succeeds. Within one Pluto process, enable and disable writes for a guild run one at a time. |
| `/props disable` | Sets `PROPS_ENABLED` to false. |
| `/props status` | Shows the server's own `/props` switch (not set up, enabled, disabled), the autopost toggle on its Khronos settings row, the saved strategy and the post time: `HH:MM UTC` for a server with its own daily time, otherwise the shared schedule. When the row turns the autopost off while `/props` is on, the heading reads paused and the reply says posting is off and that staff manage that setting. Khronos still skips a post for reasons Pluto cannot see, such as the per-sport `PROPS_AUTOPOST_<SPORT>` switch or a post already made today, so enabled plus an on row does not guarantee a post. A guild without a settings row shows the `default` strategy and the shared schedule. |
| `/props strategy strategy:<default\|smart>` | Saves the selection strategy in Khronos. Saving `smart` replies that it is saved and posts as `default` whenever smart cannot run, for example while AI props are off. A `400` from Khronos answers "That strategy is not available for this server yet", a `401` or `403` says Pluto is not allowed to change settings, and a timeout says the save could not be confirmed and points to `/props status`. |

Whether `smart` actually changes selection, and which guilds may use it, is decided in Khronos. `GET /props/settings` returns the saved strategy, the server's autopost toggle and its post time, but no effective strategy, so Pluto reports the saved value with the fallback condition instead of guessing which one runs. The daily post time is stored in Khronos as `HH:MM` UTC; Pluto displays it but has no command to change it.

## Daily posting

Khronos sends the day's props to `POST /props/daily` as a durable `prop_post` envelope (see [Durable notification receiver](durable-notification-receiver.md)). Pluto queues one destination per guild and over/under pair and posts each pair as its own message, an embed with Over and Under buttons. The sport is NFL when the prop's `sport_title` contains "nfl" in any letter case, and NBA otherwise. Each delivered pair returns two receipts, one per outcome, both pointing at the same message.

This build posts one message per pair. When a payload carries a `boards` field, Pluto validates it (an invalid one answers `422`) and includes it in the payload hash, but still posts the pairs one message each.

When a tracked posted prop settles, Khronos sends a `prop_settled` envelope to `POST /notifications/props/settled` and Pluto edits the referenced messages. Khronos sends nothing for outcomes it has no tracked post for.

A corrected result (`correction: true`, `supersedes_result`, `revision`) re-grades the post like any settlement and also posts a correction notice in the same channel, as a Components V2 reply to the settled message, that names the result it replaces. The notice carries the corrected result and the predictor tally. It posts once per outcome, revision and message: a Redis marker claimed before the send and released if the send fails keeps a retry from posting it twice, and Discord's nonce covers the same window in the message itself. A pair whose over and under outcomes are both corrected gets one notice per corrected outcome. Each message also records the highest revision it has applied, so a retry of an older revision whose notice failed leaves a newer grade and its notice alone. When a correction's notice cannot be sent, both the queued delivery and the legacy non-envelope request fail and are retried; an original settlement keeps the legacy path's log-and-continue behaviour.

## Staff commands

`/admin` needs the Administrator permission by default and runs only in a server.

| Subcommand | What it does |
| --- | --- |
| `/admin props generate [count]` | Fetches processed prop pairs for the guild's sport from Khronos and posts them to the guild's prediction channel. `count` defaults to 10. |
| `/admin props pick sport:<NBA\|NFL> [game] [category] [player]` | Opens a picker over the full slate for the sport. `game` filters by team name, `category` by market key such as `player_points`, and `player` by name. Up to 25 pairs can be selected. A session expires 30 minutes after its last change. Pressing Post re-reads every selected price first: if a price moved or a prop is no longer quoted, Pluto updates or removes it and asks you to review and press Post again. If a price lookup itself fails, Pluto keeps the selection and stops the post. Otherwise it asks Khronos to post the selection to the current guild and reports how many were posted, skipped and failed. |
| `/admin props viewactive` | Lists props that have active predictions. |
