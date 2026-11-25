# Bet result notifications

Khronos tells Pluto when a single bet settles, and Pluto sends the bettor a direct message. Won and lost bets get a result DM. A refunded bet gets a refund DM that says why the stake came back.

## Routes

`POST /notifications/bets/results` accepts two shapes.

- A durable delivery envelope with `kind: "h2h_result"` is stored and queued like the other durable kinds and answers `202`. See [Durable notification receiver](durable-notification-receiver.md). This kind carries one bet whose `result` is `won` or `lost`; it has no refund shape.
- A legacy batch with `winners`, `losers` and `pushes` arrays is processed synchronously. It answers `200` with `{ "success": true }`, `422` when validation fails, and `500` when processing throws. A body that has a `delivery_id` but is not a valid envelope answers `422` and is not treated as a legacy batch.

Refunds reach users only through the legacy batch, as entries in `pushes`.

## Refund reasons

A legacy batch may carry a top-level `refund_reason`, which applies to every entry in its `pushes`. Pluto reads it with its own schema in `notification-utils.ts`, so it works whether or not the installed `@pluto-khronos/types` keeps the field. An absent field means a tie, which is the only refund older Khronos builds sent. A value Pluto does not know is dropped and the refund is still delivered with the tie copy.

| `refund_reason` | DM title | Reason line |
| --- | --- | --- |
| `tie` or absent | 🔄 Bet Refunded - Tie Game | The match ended in a tie. Your bet has been refunded. |
| `postponed` | 🔄 Bet Refunded - Game Postponed | The game was postponed and not played in time, so your bet was voided and refunded. |
| `cancelled` | 🔄 Bet Refunded - Game Cancelled | The game was cancelled, so your bet was voided and refunded. |
| `abandoned` | 🔄 Bet Refunded - Game Abandoned | The game was abandoned before it finished, so your bet was voided and refunded. |
| `void` | 🔄 Bet Refunded - Bet Voided | Your bet was voided, so your stake has been refunded. |

The refund DM is a Components V2 message built by `refundResultPayload` in `src/lib/discord/builders/notifications.ts`. Below the title and reason it shows the team selected, the refunded amount and the bet id. Won and lost DMs are still classic embeds built by `betResultEmbed`.

Pluto decides nothing about refunds. Khronos voids the bet, credits the stake and chooses the reason; Pluto only words the message.
