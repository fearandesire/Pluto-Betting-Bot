# ADR 001: Durable notification receiver

- Status: Accepted
- Date: 2026-07-15
- Source: `src/utils/api/routes/notifications/delivery-store.ts`, `src/utils/api/routes/notifications/delivery-queue.ts`

## Context

Khronos sends notification callbacks to Pluto for Discord fanout. The receiver has to be safe when Khronos retries a callback, Pluto restarts, Redis/BullMQ acknowledge ambiguously, or Discord is temporarily unavailable.

The important requirement is durability before fanout: Pluto must remember that a delivery was accepted and enqueue work before returning success to Khronos. Discord delivery then happens asynchronously from the durable queue.

## Decision

Pluto stores every delivery under Redis key prefix `pluto:delivery:v1:` with a 180 day TTL and enqueues accepted delivery envelopes to BullMQ queue `notification-delivery-v1`.

For a new `delivery_id`, Pluto:

1. Builds a delivery record with state `queued` and per-destination state `queued`.
2. Writes the record to Redis with `NX` and `EX` retention.
3. Adds a BullMQ job named `deliver` using `delivery_id` as the stable `jobId`.
4. Returns HTTP `202` after the durable store/queue accept path completes, before Discord fanout.

This is not fire-and-forget after Discord. The HTTP response acknowledges durable acceptance into Pluto, not final Discord delivery.

For a repeated `delivery_id`, Pluto compares a stable SHA-256 payload hash:

- Same payload hash: treat as duplicate and return the existing delivery record.
- Different payload hash: reject with conflict (`DELIVERY_PAYLOAD_MISMATCH`, HTTP `409`).

If an accepted or duplicate record is still `queued` or `retryable_failed`, the receiver may re-enqueue the BullMQ job. This is safe because BullMQ uses `delivery_id` as the stable job id.

## Consequences

- Khronos can retry callbacks with the same delivery id without causing duplicate Discord fanout for already completed destinations.
- A reused delivery id with a different payload fails loudly instead of overwriting history.
- Operators can inspect delivery state for up to 180 days.
- HTTP `202` means "accepted for durable delivery", not "all Discord messages are delivered".
