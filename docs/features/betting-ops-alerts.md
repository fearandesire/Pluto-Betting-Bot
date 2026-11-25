# Betting ops alerts

When `BETTING_OPS_WEBHOOK_URL` is set, Pluto posts critical betting failures to that Discord webhook. Unset or blank disables alerts. Pluto checks only that the value is a URL, so point it at a staff-only channel: alerts carry the metadata listed below.

| Event | When | Alert key |
| --- | --- | --- |
| `command.failed` | One of the betting slash commands threw an unexpected error. | Event, command and error class. |
| `interaction.expired_before_ack` | One of those commands failed with Discord's Unknown Interaction error (`10062`). | Event, command and error class. |
| `bet.placement_failed` | Single-bet placement threw an exception, either in the Khronos call or in Pluto's own steps after Khronos answered `2xx`, such as the confirmation reply. | Event and error class. |
| `khronos.betting_unavailable` | A Khronos call whose path matches a betslips or parlays resource and action timed out, failed on the network, or answered `5xx`. A status below 500 does not raise this alert. | Event, route and cause. |

For `khronos.betting_unavailable` the route is reduced to its resource and action, such as `betslips/place`, so ids in the URL path are not included. Every alert can include the event, the command, the guild, channel and user ids when the caller has them, the request id, and a one-line error description in which `http` and `https` URLs are replaced by `[url]`. Other text in the error message is kept.

Each process sends an alert key at most once every ten minutes and counts the repeats it suppressed in the next alert for that key. Pluto first posts a Components V2 message. If Discord rejects it, Pluto sends one plain-text post instead. Each post has its own three second timeout. A rejected or failed post logs `betting_ops.alert_failed` without failing the command, and those log lines do not include the webhook URL.

## What the user sees

When single-bet placement gets a non-`2xx` answer or throws, the user sees **Bet not confirmed**: "We couldn't confirm your bet. Check /mybets before you try again." This copy appears even for some failures that are definite. When a betting slash command throws and Discord still accepts a reply, the common error handler shows a generic error. Both carry a reference made of the last eight digits of the interaction id, which lets staff find the full id in logs. Parlay confirmation has its own wording, which may carry no reference.

Pluto also logs `process.event_loop_lag` when the event loop's p99 delay in a sampling window exceeds 200 ms.
