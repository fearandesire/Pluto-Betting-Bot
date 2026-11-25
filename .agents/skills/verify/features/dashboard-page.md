# Open queue dashboard

## Sub-features

Open queue dashboard and its observable result.

## How to get to it (user POV)

An operator opens `/api/pluto/admin/queues` using verification-only Basic authentication.

## Driving it with the verification command

The driver requests the actual compiled dashboard route, asserts HTTP 200, HTML content type and an HTML document, using the installed Koa/BullBoard packages.

## Gotchas

The driver links all compiled modules but evaluates only the dashboard setup; it does not start the full Discord bot. Queue I/O and app configuration are the existing isolated boundaries.
