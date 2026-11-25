# Player props

Khronos selects the day's player props and asks Pluto to post them. Pluto posts each prop to the guild's props channel, records a receipt per message, and edits the message when the prop settles. Guild admins control whether and how their server receives props.

## Server commands

`/props` needs the Administrator permission by default and runs only in a server. Every reply is private.

| Subcommand | What it does |
| --- | --- |
| `/props enable channel:<text channel>` | Checks that Pluto can View Channel, Send Messages, Embed Links and Read Message History in the channel, saves it as the guild's predictions channel, then sets `PROPS_ENABLED` to true. Posting stays off until the channel save succeeds, and writes for one guild run one at a time. |
| `/props disable` | Sets `PROPS_ENABLED` to false. |
| `/props status` | Shows whether props are not set up, enabled or disabled, the channel, the strategy, and the daily post time. A guild without a settings row shows the `default` strategy and the default schedule. |
| `/props strategy strategy:<default\|smart>` | Saves the selection strategy in Khronos. A `400` from Khronos answers "That strategy is not available for this server yet", a `401` or `403` says Pluto is not allowed to change settings, and a timeout says the save could not be confirmed and points to `/props status`. |

Whether `smart` actually changes selection, and which guilds may use it, is decided in Khronos. The daily post time is stored in Khronos as `HH:MM` UTC; Pluto displays it but has no command to change it.

## Daily posting

Khronos sends the day's props to `POST /props/daily` as a durable `prop_post` envelope (see [Durable notification receiver](durable-notification-receiver.md)). Pluto queues one destination per guild and over/under pair and posts each pair as its own message, an embed with Over and Under buttons. The sport is NFL when the prop's `sport_title` contains "nfl", and NBA otherwise. Each delivered pair returns two receipts, one per outcome, all pointing at the same message.

This build posts one message per pair. It does not read a `boards` field, so a payload that carries one is posted pair by pair.

When a prop settles, Khronos sends a `prop_settled` envelope to `POST /notifications/props/settled` and Pluto edits the referenced messages.

## Staff commands

`/admin` needs the Administrator permission by default and runs only in a server.

| Subcommand | What it does |
| --- | --- |
| `/admin props generate [count]` | Fetches processed prop pairs for the guild's sport from Khronos and posts them to the guild's prediction channel. `count` defaults to 10. |
| `/admin props pick sport:<NBA\|NFL> [game] [category] [player]` | Opens a picker over the full slate for the sport. `game` filters by team name, `category` by market key such as `player_points`, and `player` by name. Up to 25 pairs can be selected, and a session lasts 30 minutes. Pressing Post re-reads every selected price first: if a price moved or a prop is no longer quoted, Pluto updates or removes it and asks you to review and press Post again. Otherwise it asks Khronos to post the selection to the current guild and reports how many were posted, skipped and failed. |
| `/admin props viewactive` | Lists props that have active predictions. |
