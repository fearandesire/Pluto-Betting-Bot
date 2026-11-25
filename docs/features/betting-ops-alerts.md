# Betting ops alerts

When `BETTING_OPS_WEBHOOK_URL` is set, Pluto posts critical betting failures to that Discord webhook. Unset or blank disables alerts. Pluto checks only that the value is a URL, so point it at a staff-only channel: alerts carry the metadata listed below.

| Event | When | Alert key |
| --- | --- | --- |
| `command.failed` | One of the betting slash commands threw an unexpected error. | Event, command and error class. |
| `interaction.expired_before_ack` | One of those commands failed with Discord's Unknown Interaction error (`10062`). | Event, command and error class. |
| `bet.placement_failed` | Bet placement threw while talking to Khronos. This can fire even after the user was already answered. | Event and error class. |
| `khronos.betting_unavailable` | A Khronos betslip or parlay call timed out, failed on the network, or answered `5xx`. A status below 500 does not raise this alert. | Event, route and cause. |

For `khronos.betting_unavailable` the route is reduced to its resource and action, such as `betslips/place`, so ids in the URL path are not included. Every alert can include the event, the command, the guild, channel and user ids when the caller has them, the request id, and a one-line error description with URLs replaced by `[url]`.

Each process sends an alert key at most once every ten minutes and counts the repeats it suppressed in the next alert for that key. Pluto first posts a Components V2 message. If Discord rejects it, Pluto sends one plain-text post instead. Each post has its own three second timeout. A rejected or failed post logs `betting_ops.alert_failed` without failing the command, and those log lines do not include the webhook URL.

## What the user sees

On the betting command paths that report these failures, and while Discord still accepts a reply, a placement whose outcome Pluto cannot confirm usually shows **Bet not confirmed**: "We couldn't confirm your bet. Check /mybets before you try again." Other failures show a generic error. Both carry a reference made of the last eight digits of the interaction id, which lets staff find the full id in logs. Parlay confirmation has its own wording.

Pluto also logs `process.event_loop_lag` when the event loop's p99 delay in a sampling window exceeds 200 ms.
