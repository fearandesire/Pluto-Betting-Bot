# Game channels and postponed games

Khronos owns every game's schedule and status. Pluto creates a channel for a game, keeps the match card in it current, and reflects status changes Khronos sends. Pluto never decides on its own that a game is postponed, rescheduled or cancelled.

## Status values

A game presentation carries one of `scheduled`, `live`, `final`, `postponed` or `cancelled`. Khronos sends presentations on the channel-creation queue and on the `channel-presentation-update` queue, each update with a revision number. Pluto applies a revision once, under a per-game lock, and skips a revision it has already applied.

## When a channel is created

On the schema-version-2 creation path, `creationBlock` in `ChannelPresentationService.ts` decides whether a game may get a channel now:

| Condition | Result |
| --- | --- |
| Status is anything other than `scheduled` | Skipped (`not_scheduled`). A postponed or cancelled game never gets a new channel. |
| Tip-off is missing or invalid | Skipped (`invalid_gametime`). |
| Tip-off has passed | Skipped (`tipoff_passed`). |
| Tip-off is more than one hour away | Deferred (`creation_window_not_open`). |
| No `schedule_provider` or `schedule_snapshot_ref` | Held (`missing_schedule_evidence`). |
| `schedule_observed_at` is invalid or in the future | Held (`invalid_schedule_evidence`). |
| `schedule_observed_at` is more than six hours old | Held (`stale_schedule_evidence`). |

A card also waits for Khronos's initial odds completion before it is first posted (`awaiting_initial_odds`). Each decision is logged as a `game_channel.stage` event with the game, guild, stage, outcome and reason.

## Rescheduled games

A new tip-off time arrives as a new presentation revision. If the game has no channel yet, the one-hour window is checked against the new time, so a game moved to a later date is deferred until its new window opens. If the channel and its card exist, Pluto edits the card in place with the new time.

## Postponed and cancelled games

When an existing card's status becomes `postponed` or `cancelled`, the card shows **Postponed** or **Cancelled** and drops the tip-off time. A status change does not delete the channel. Deletion is a separate request from Khronos, either `DELETE /channels/delete` with the channel names or a job on `channel-deletion-queue`.

Bets on a voided game are refunded by Khronos. The refund DM names the reason, such as Game Postponed or Game Cancelled. See [Bet result notifications](bet-result-notifications.md).
