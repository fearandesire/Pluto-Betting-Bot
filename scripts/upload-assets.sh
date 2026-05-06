#!/usr/bin/env bash
# Upload assets/matchupimages/ to Cloudflare R2 as a single tarball.
# See README "Assets" section for setup. Run from repo root: `pnpm assets:upload`.
set -euo pipefail

BUCKET="pluto-assets"
KEY="matchupimages.tar.gz"
PROFILE="${R2_AWS_PROFILE:-pluto-r2}"
ACCOUNT_ID="${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID env var}"
ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

if [[ ! -d assets/matchupimages ]]; then
  echo "ERROR: assets/matchupimages not found. Run from repo root." >&2
  exit 1
fi

TMP=$(mktemp -t matchupimages.XXXXXX.tar.gz)
trap 'rm -f "$TMP"' EXIT

echo "Packing assets/matchupimages → $TMP"
tar -czf "$TMP" -C assets matchupimages

SIZE=$(du -h "$TMP" | cut -f1)
COUNT=$(find assets/matchupimages -type f | wc -l | tr -d ' ')
echo "Uploading $COUNT files ($SIZE) to s3://$BUCKET/$KEY"

aws s3 cp "$TMP" "s3://$BUCKET/$KEY" \
  --endpoint-url="$ENDPOINT" \
  --profile "$PROFILE"

echo "Done."
