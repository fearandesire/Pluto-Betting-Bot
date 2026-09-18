# ADR 002: Atomic cache operations

- Status: Accepted
- Date: 2026-07-15
- Source: `src/utils/cache/redis-instance.ts`, `src/utils/cache/__tests__/redis-atomic-contract.ts`

## Context

Pluto uses Redis for coordination primitives such as reservations, ownership checks, and lock-like delivery state transitions. These operations must be correct under concurrency; the point is not merely to cache values for performance.

A naive read-then-write sequence can remove another worker's lock, refresh a lease no longer owned by the caller, or overwrite a state that changed between commands.

## Decision

`src/utils/cache/redis-instance.ts` exposes typed atomic operations on `RedisCacheClient`:

- `compareAndRemove(key, expectedValue)`: delete a key only when the current value still matches the expected owner/value.
- `refreshIfOwned(key, expectedValue, seconds)`: extend expiry only when the caller still owns the value.
- `transitionIfValue(key, expectedValue, nextValue, seconds?)`: move a value to the next state only if it is still in the expected state, preserving TTL unless a replacement TTL is supplied.

The production Redis implementation uses Lua scripts so each operation is evaluated atomically by Redis. The in-memory implementation mirrors the same contract for tests and mock mode.

## Verification

`src/utils/cache/__tests__/redis-atomic-contract.ts` defines the shared contract. It is run against both implementations:

- Real Redis through `createAtomicRedisClient` in `src/utils/cache/__tests__/redis-atomic.integration.test.ts`.
- In-memory Redis in `src/utils/cache/__tests__/redis-instance.test.ts`.

## Consequences

- Reservation and lock correctness does not depend on timing between separate `GET`, `DEL`, `EXPIRE`, or `SET` calls.
- Test fixtures exercise the same behavioral contract as production Redis.
- Callers should use these typed operations for ownership-sensitive state changes instead of raw Redis command sequences.
