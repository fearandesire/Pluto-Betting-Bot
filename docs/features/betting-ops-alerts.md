# Betting ops alerts

When `BETTING_OPS_WEBHOOK_URL` is set, Pluto posts critical betting failures to that Discord webhook. Unset or blank disables alerts, and the URL is never logged.

| Event | When |
| --- | --- |
| `command.failed` | A betting command threw an unexpected error. |
| `interaction.expired_before_ack` | A betting command failed because its Discord interaction expired before it was acknowledged. |
| `bet.placement_failed` | Placing a bet threw before Khronos gave a definite answer. |
| `khronos.betting_unavailable` | A Khronos betslip or parlay call timed out, failed on the network, or answered `5xx`. A status below 500 is a normal answer the user sees and does not page. The route is reduced to its first two segments, such as `betslips/place`, so no id reaches the alert. |

Alerts with the same key, built from the event, the route or command and the cause, are sent at most once every ten minutes per process. A webhook post has a three second timeout, and a failed post logs `betting_ops.alert_failed` without failing the command.

## What the user sees

When a placement command fails and Pluto cannot tell whether Khronos wrote the bet, the user sees **Bet not confirmed**: "We couldn't confirm your bet. Check /mybets before you try again." with a reference made of the last eight digits of the interaction id. Other betting commands show a generic error with the same reference. The reference lets staff find the full interaction id in logs.

Pluto also logs `process.event_loop_lag` when the event loop's p99 delay in a sampling window exceeds 200 ms.
