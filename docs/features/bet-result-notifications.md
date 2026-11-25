# Bet result notifications

Khronos tells Pluto when a single bet settles, and Pluto tries to send the bettor a direct message. Won and lost bets get a result DM. A refunded bet gets a refund DM that says why the stake came back.

## Routes

`POST /notifications/bets/results` accepts two shapes.

- A durable delivery envelope with `kind: "h2h_result"` answers `202` once it is accepted: either stored and queued, or matched to an existing delivery with the same payload, which is returned without being queued again. See [Durable notification receiver](durable-notification-receiver.md). This kind carries one bet whose `result` is `won` or `lost`; it has no refund shape.
- A legacy batch with `winners`, `losers` and `pushes` is processed before the route answers. `winners` and `losers` may be null and `pushes` may be omitted. It answers `200` with `{ "success": true }` when processing finishes, `422` when validation fails, and `500` when processing throws. A DM that fails for one user is logged and does not fail the request, so a `200` means Pluto attempted the DMs, not that each one arrived. A body that has a `delivery_id` but is not a valid envelope answers `422` and is not treated as a legacy batch.

On this endpoint, refunds reach users only through the legacy batch, as entries in `pushes`.

## Refund reasons

A legacy batch may carry a top-level `refund_reason`, which applies to every entry in its `pushes`. Pluto reads it with its own schema in `notification-utils.ts`, so it works whether or not the installed `@pluto-khronos/types` keeps the field. An absent or unknown value uses the tie wording, and the refund is still delivered. The DM names a void reason only when Khronos supplies one Pluto recognizes.

| `refund_reason` | DM title | Reason line |
| --- | --- | --- |
| `tie`, absent or unknown | 🔄 Bet Refunded - Tie Game | The match ended in a tie. Your bet has been refunded. |
| `postponed` | 🔄 Bet Refunded - Game Postponed | The game was postponed and not played in time, so your bet was voided and refunded. |
| `cancelled` | 🔄 Bet Refunded - Game Cancelled | The game was cancelled, so your bet was voided and refunded. |
| `abandoned` | 🔄 Bet Refunded - Game Abandoned | The game was abandoned before it finished, so your bet was voided and refunded. |
| `void` | 🔄 Bet Refunded - Bet Voided | Your bet was voided, so your stake has been refunded. |

The refund DM is a Components V2 message built by `refundResultPayload` in `src/lib/discord/builders/notifications.ts`. Below the title and reason it shows the team selected, the refunded amount and the bet id. Won and lost DMs are still classic embeds built by `betResultEmbed`.

Pluto decides nothing about refunds. Khronos voids the bet, credits the stake and chooses the reason; Pluto only words the message.
