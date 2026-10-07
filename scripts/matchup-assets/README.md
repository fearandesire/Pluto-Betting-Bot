# Matchup artwork build

The registry in `teams.json` owns team identity. Both the runtime registry and
builder hash `JSON.stringify(JSON.parse(teamsJson))` for its revision.

Recover originals into a **new, empty** cache and evidence directory:

```sh
node scripts/matchup-assets/source-originals.mjs \
  --audit /path/to/frozen-audit \
  --output /path/to/originals-cache \
  --evidence /path/to/source-evidence
```

The recovery script uses bounded public ESPN scoreboards for 2022–2025 NFL
games and the verified January 30, 2023 Hawks–Blazers game. It resolves exact
competitor names through the registry before constructing the ESPN stitcher
image URL. Pro Bowl selections and unsupported historical labels are excluded.
Each accepted original is an unmodified 400×400 PNG with event identity,
original URL, metadata URL, date, byte hash, and attempts recorded in provenance.

Direct Google image search was attempted and encountered an unusual-traffic
CAPTCHA. It was not bypassed. Free public image search identified the ESPN
source family; per-pair Google query URLs are recorded as reproducible search
queries, not as claims that every query was successfully executed.

Build a candidate into **new, empty** destinations:

```sh
node scripts/matchup-assets/build.mjs \
  --input /path/to/frozen-audit/matchupimages \
  --audit /path/to/frozen-audit \
  --output /path/to/candidate/matchupimages \
  --evidence /path/to/artwork-evidence \
  --originals /path/to/originals-cache
```

Original PNG cache files remain outside Git. Restore pinned original bytes into a new cache with `node scripts/matchup-assets/source-originals.mjs --restore scripts/matchup-assets/originals/provenance.json --output assets/source-cache`, then pass `--originals assets/source-cache`. Any source hash drift stops restoration; the immutable serving archive retains the approved bytes. The official-logo cache and original provenance are tracked. Cached
originals are hash-checked and copied byte-for-byte. Only a pair with a recorded
unavailable-source result can use the 400×400 diagonal fallback. The current
repair has 102 recovered originals and zero generated fallbacks.

The builder preserves all 1,301 approved baseline files, verifies the 12 reuse
sources immediately before copying, and records the 119 repairs plus the absent
Bears–Commanders pair. Washington and uppercase `Vs` path normalization is
collision-checked. Input folders are never changed, output overlays and
symlinks are refused, and nothing is uploaded.

The candidate includes a pending manifest, repair closure receipt, and original
source receipt. The evidence includes 10 before/after sheets, a local board,
full physical-file mappings, source provenance, and pending review records.
The coordinator records observed team IDs and exact hashes after actual visual
review, finalizes the manifest content identity, and owns release validation.
Pending receipts are deliberately unusable as release approvals.

`sharp` is a pinned build-only dependency. Runtime code does not import it.
The bundled DejaVu font is used only for evidence labels; its license is in
`fonts/LICENSE-DejaVu.txt`. Recovered originals are never re-rendered.
