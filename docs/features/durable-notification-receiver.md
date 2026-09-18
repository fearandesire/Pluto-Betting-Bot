# Durable notification receiver

Pluto accepts Khronos notification delivery envelopes, persists their delivery state in Redis, and fans out to Discord from BullMQ workers. The HTTP receiver returns `202 Accepted` once the delivery is durably stored and queued; Discord fanout happens after that response.

All routes are mounted without an additional API prefix. The Koa app-level API key middleware requires `X-API-Key` or `apiKey` unless a route is explicitly exempted.

## Hard values

| Value | Setting | Source |
| --- | --- | --- |
| Redis key prefix | `pluto:delivery:v1:` | `src/utils/api/routes/notifications/delivery-store.ts` |
| Retention | 180 days (`180 * 24 * 60 * 60` seconds) | `src/utils/api/routes/notifications/delivery-store.ts` |
| BullMQ queue | `notification-delivery-v1` | `src/utils/api/routes/notifications/delivery-queue.ts` |
| BullMQ job name | `deliver` | `src/utils/api/routes/notifications/delivery-queue.ts` |
| BullMQ job id | `delivery_id` | `src/utils/api/routes/notifications/delivery-queue.ts` |

## Delivery envelope

Durable receivers expect `schema_version: 1`, a UUID `delivery_id`, an RFC 3339 `occurred_at`, a `kind`, and a kind-specific payload.

Supported durable kinds:

- `parlay_result`
- `prop_settled`
- `prop_post`

A stable payload hash is computed from `schema_version`, `kind`, `occurred_at`, and `payload`. Reusing a `delivery_id` with a different hash returns `409 DELIVERY_PAYLOAD_MISMATCH`.

## Endpoints

All mounted endpoints can return `401` from the app-level API-key middleware when `X-API-Key` or `apiKey` is missing or invalid.

### `POST /notifications/parlays/results`

Accepts durable `parlay_result` envelopes.

| Status | Meaning |
| --- | --- |
| `202` | Delivery was stored and queued. Response body includes `delivery_id` and `status`. |
| `409` | The same `delivery_id` already exists for a different payload (`DELIVERY_PAYLOAD_MISMATCH`). |
| `422` | A request containing `delivery_id` failed delivery envelope validation. Legacy non-envelope validation failures also return `422`. |
| `503` | Pluto could not persist or enqueue the delivery. |

Legacy non-envelope parlay payloads are still processed synchronously by the route.

### `POST /notifications/props/settled`

Accepts durable `prop_settled` envelopes and has a route-local API-key guard in addition to the app-level middleware.

| Status | Meaning |
| --- | --- |
| `202` | Delivery was stored and queued. Response body includes `delivery_id` and `status`. |
| `409` | The same `delivery_id` already exists for a different payload (`DELIVERY_PAYLOAD_MISMATCH`). |
| `422` | A request containing `delivery_id` failed delivery envelope validation. Legacy non-envelope validation failures also return `422`. |
| `503` | Pluto could not persist or enqueue the delivery. |

Legacy non-envelope prop settlement payloads are still processed synchronously by the route.

### `POST /props/daily`

Accepts durable `prop_post` envelopes for daily prop posting.

| Status | Meaning |
| --- | --- |
| `202` | Delivery was stored and queued. Response body includes `accepted`, `duplicate`, `delivery_id`, `kind`, `status`, and any prop-post `receipts` already present. |
| `409` | The same `delivery_id` already exists for a different payload (`DELIVERY_PAYLOAD_MISMATCH`). |
| `422` | Envelope or daily props payload validation failed, props/guilds were empty, or a guild sport was unsupported. |
| `503` | Pluto could not persist or enqueue the prop-post delivery. |

### `GET /deliveries/:delivery_id`

Looks up a delivery by UUID and returns the persisted status view.

| Status | Meaning |
| --- | --- |
| `200` | Delivery found. Response includes `delivery_id`, `kind`, `status`, `attempts`, `destinations`, optional prop-post `receipts`, and `delivered_at`. |
| `404` | No delivery record exists for that id. |
| `422` | `delivery_id` is missing or is not a UUID. |

## States

Delivery records and destinations use the same state vocabulary:

| State | Meaning |
| --- | --- |
| `queued` | Accepted and waiting for BullMQ worker processing. |
| `processing` | A worker is attempting delivery. |
| `delivered` | All required destinations are delivered. For `prop_post`, required receipts must also be exact. |
| `retryable_failed` | At least one destination failed transiently and BullMQ should retry. |
| `permanent_failed` | Delivery cannot complete because one or more destinations failed permanently. |

Destination ids are derived by kind:

- `parlay_result`: `dm:<user_id>`
- `prop_settled`: `prop:<guild_id>:<channel_id>:<message_id>`
- `prop_post`: `prop-post:<guild_id>:<channel_id>:<over_outcome_uuid>:<under_outcome_uuid>`

## Looking up a delivery

Use the status endpoint when possible:

```bash
curl -sS \
  -H "X-API-Key: $PLUTO_API_KEY" \
  "https://<pluto-host>/deliveries/<delivery_id>"
```

For low-level Redis inspection, records are stored as JSON at:

```text
pluto:delivery:v1:<delivery_id>
```

A `202` receiver response only confirms durable acceptance. Use `GET /deliveries/:delivery_id` to verify final Discord delivery state.
