# Protect queue dashboard

## Sub-features

Protect queue dashboard and its observable result.

## How to get to it (user POV)

Open `/api/pluto/admin/queues/api/queues` without dashboard credentials.

## Driving it with the verification command

`scripts/verify-production-runtime.mjs` launches the emitted Koa/BullBoard setup on an ephemeral loopback port and asserts unauthenticated HTTP 401.

## Gotchas

The maintained driver supplies fixed verification-only Basic credentials. It does not read live dashboard credentials or access production queues.
