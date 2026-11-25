# Game channels and postponed games

Pluto takes each game's desired presentation, including its schedule and status, from Khronos. Pluto creates a channel for a game, keeps the match card in it current, and reflects status changes Khronos sends. Pluto never decides on its own that a game is postponed, rescheduled or cancelled.

This page describes the opt-in presentation path, used when Khronos sends channel-creation jobs with `schemaVersion: 2`. Jobs without a `schemaVersion` still go through the older channel manager, which this page does not cover.

## Status values

A game presentation carries one of `scheduled`, `live`, `final`, `postponed` or `cancelled`. Khronos sends two job shapes: a channel-creation job with `schemaVersion: 2` and the presentation, and a `channel-presentation-update` job that adds a top-level `revision`. A job that fails its queue schema, for example one with a missing or malformed tip-off time or a malformed `schedule_observed_at`, is rejected before any of the checks below run.

Khronos holds the desired presentation, its revision and the last revision Pluto acknowledged for each guild and game. A job does not carry the state Pluto applies: it wakes a worker that loads the current state from Khronos, so several quick updates can collapse into one Discord edit. The work runs under a per-guild, per-game lock. When the desired revision is already acknowledged, the job is skipped. Pluto writes to Discord first and sends the acknowledgement to Khronos afterwards, so a failure between the two can repeat the same edit on retry.

## When a channel is created

For a job that passed its schema, `creationBlock` in `ChannelPresentationService.ts` decides whether a game may get a channel now:

| Condition | Result |
| --- | --- |
| Status is anything other than `scheduled` | Skipped (`not_scheduled`). A postponed or cancelled game never gets a new channel. |
| Tip-off has passed | Skipped (`tipoff_passed`). |
| Tip-off is more than one hour away | Deferred (`creation_window_not_open`). |
| No `schedule_provider` or `schedule_snapshot_ref` | Held (`missing_schedule_evidence`). |
| `schedule_observed_at` is missing or in the future | Held (`invalid_schedule_evidence`). |
| `schedule_observed_at` is more than six hours old | Held (`stale_schedule_evidence`). |

`creationBlock` also has a defensive `invalid_gametime` skip for a tip-off that does not parse, but the queue schema already rejects such jobs.

A game with no card yet and no live price also waits for Khronos's initial odds completion proof (`awaiting_initial_odds`). That check can hold channel creation as well as the first post. A card that already exists, or a presentation whose betting is already available, does not need the proof. Each decision is logged as a `game_channel.stage` event with the game, guild, stage, outcome and reason.

## Rescheduled games

A new tip-off time arrives as a new presentation revision. If the game has no channel yet, the one-hour window is checked against the new time, so a game moved to a later date is deferred until its new window opens. If the channel and its card exist, Pluto edits the card in place with the new time.

A presentation may also carry `schedule_change`: the status Khronos stored for the game, the reason when it has one, and both the effective and the original start time. For `rescheduled` and `delayed`, the card says **Rescheduled** or **Delayed** above the new time, and adds the time it left as *Was <t:old:F>* when that time differs from the one shown. Pluto prints that detail only on a game that has not started and only while the effective start matches the tip-off on the card, so a lifecycle row Khronos has not caught up with is ignored instead of appearing next to a contradictory time, and a game that has since gone live or final keeps that status.

## Postponed and cancelled games

When an existing card's status becomes `postponed` or `cancelled`, the card shows **Postponed** or **Cancelled** and drops the tip-off time. A `schedule_change` for either status is shown only when it matches the card's own status, and a stored reason that differs from the status is appended, such as **Postponed · abandoned**. A status change does not delete the channel. Deletion is a separate request. Pluto accepts it either as `DELETE /channels/delete` with the channel names or as a job on `channel-deletion-queue`.

Bets on a voided game are refunded by Khronos. When Khronos supplies a refund reason Pluto recognizes, the refund DM names it, such as Game Postponed or Game Cancelled. See [Bet result notifications](bet-result-notifications.md). `/mybets` shows such a bet as a push, because Khronos stores a voided game as a push and its bets response carries no refund reason.

A suspended game is not a status the card carries: ESPN reports a suspension mid-game, so the presentation says `live`, the card keeps that status, and Khronos keeps `suspended` for its dashboard.
