# Inspect queue status

## Sub-features

Inspect queue status and its observable result.

## How to get to it (user POV)

An authenticated operator loads the queue summaries.

## Driving it with the verification command

The driver requests the compiled dashboard queue API, verifies every registered queue is present and the waiting/active counts are read through real BullBoard adapters, then closes its owned HTTP server.

## Gotchas

Queue state is synthetic. Discord betting and Khronos financial settlement are optional external journeys, explicitly skipped in the manifest.
