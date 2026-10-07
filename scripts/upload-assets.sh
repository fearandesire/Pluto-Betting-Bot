#!/usr/bin/env bash
# Compatibility entrypoint: only uploads the explicit immutable release lock.
set -euo pipefail
exec node "$(dirname "$0")/assets-r2.js" upload "$@"
