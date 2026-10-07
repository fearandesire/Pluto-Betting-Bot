# Matchup image releases

NBA/NFL artwork resolves from structured away/home team identities. The sport-scoped registry in `scripts/matchup-assets/teams.json` is the source for the generated TypeScript identity module. Unknown, self, or cross-sport teams return no image. A missing or invalid manifest emits a bounded structured diagnostic; the channel can still send its text. Runtime lookup never calls a remote image service.

Every release covers 435 NBA and 496 NFL unordered pairs and 1,862 home/away orderings. Each image approval binds the two observed canonical teams and the exact SHA-256. Shared images must be approved as order independent. Existing approved PNG bytes under `.jpg` names are preserved and declared `image/png`; recovered originals keep their exact bytes; generated fallbacks are square JPEGs matching the existing diagonal two-logo layout. Discord keeps its existing `match.jpg` attachment convention.

## Build and approve

Use Node 22.18+ and the frozen pnpm lockfile. Original source provenance is recorded under `scripts/matchup-assets/originals/`. Google-discovered source artwork is preferred; fallback rendering/decoding uses pinned build-only sharp and the bundled licensed font. Logo originals, source URLs, canonical identities, and hashes are recorded in `scripts/matchup-assets/logos/provenance.json`.

```sh
pnpm install --frozen-lockfile
pnpm assets:registry
node scripts/matchup-assets/generate-registry.mjs --check
pnpm build
node scripts/matchup-assets/source-originals.mjs --restore scripts/matchup-assets/originals/provenance.json --output assets/source-cache
pnpm assets:build -- --originals assets/source-cache --input /absolute/frozen/matchupimages --audit /absolute/frozen/audit --output assets/candidate/matchupimages --evidence assets/repair-evidence/artwork --logos scripts/matchup-assets/logos
```

The builder refuses input/output overlap and nonempty output, checks every source hash, stages 12 reuse files, recovers original matching artwork first and generates unavailable cards, yielding102 distinct replacement/addition cards, repairs 106 replacement targets, removes the one invalid self-matchup, and normalizes 34 filenames (32 Washington and two uppercase separators). It never uploads or changes the baseline. The original audit and optional refreshes remain separate from the mandatory repairs.

Inspect every new card and all reuse/changed mappings in the generated before/after sheets and board. Record observed team IDs and new hashes in an archive-local `visual-review/receipt.json` with `kind: "visual-review"` and an `entries` array of `{pairKey,teams,sha256}`. Set reviewed manifest approvals to that receipt; unchanged artwork retains original audit-sheet evidence. The archive-local baseline inventory also verifies all1301 preserved hashes,34 unique rename receipts and1420 physical image paths. Keep the original118 rejected pair/hash mappings in `repair-results.json` as `auditDisallowedMappings`. Its 119 repair records identify the original ID/path/hash/category, intentional action, and final path/hash/pair. A historically misfiled hash is rejected only for its wrong pair.

After finalizing approvals, recompute the manifest's release ID with `computeMatchupReleaseId` from the compiled schema. Pending/synthetic approvals never pass the real release gate.

```sh
pnpm assets:validate -- --dir assets/candidate
pnpm assets:pack -- --dir assets/candidate --archive assets/repair-evidence/candidate.tar.gz --lock config/matchup-assets-release.json
```

Validation fully decodes image pixels, checks schema/coverage, identities, paths, symlinks, hashes, decoded MIME/dimensions, hash-bound review receipts, rejected mappings, and all repair closures. Packing sorts members, fixes timestamps/owners, uses USTAR and deterministic gzip, and derives an immutable R2 key from the full archive SHA-256 (including review/provenance receipts). Repeat packing must produce the same archive hash.

## Upload and hydrate

Use the established R2 AWS route (`R2_ACCOUNT_ID` or `R2_ENDPOINT`, and the `pluto-r2` AWS profile or standard environment credentials). Keep credential values out of files and output. The upload script only creates an absent immutable key with `If-None-Match: *`; an existing key must be byte identical. It downloads again to verify the digest. The compatibility shell wrapper delegates to the same implementation and cannot overwrite the legacy mutable key.

```sh
pnpm assets:upload -- --dir assets/candidate --archive assets/repair-evidence/candidate.tar.gz --lock config/matchup-assets-release.json
pnpm assets:hydrate -- --dir assets/readback --lock config/matchup-assets-release.json
pnpm assets:validate -- --dir assets/readback
```

Hydration requires a fresh destination. It verifies the archive digest and every safe member before staging/extraction, validates the complete assets, then installs the staged tree. It stops on missing object/access failure, unsafe members, incomplete content, or failed validation. It never falls back to `matchupimages.tar.gz` or a "latest" key.

## Verify and release

Required PR checks are credential free: generated-registry consistency, typecheck, meaningful fixtures/negative cases and exhaustive lookup tests, full regressions, build and production packaging smoke. Synthetic fixtures prove identity and validation, not real artwork quality.

The trusted deployment job runs only on published releases or manual main-branch builds. It hydrates the exact pinned real archive, validates it, builds/loads a candidate, and runs all 1,862 actual container lookups disconnected from Discord before publication. A skipped trusted job does not establish release acceptance.

For a local container check, use an inert entrypoint and mount only the verifier:

```sh
docker run --rm --network none --workdir /tmp --entrypoint node --mount "type=bind,src=$PWD/scripts/verify-matchup-container.mjs,dst=/tmp/verify-matchup-container.mjs,readonly" IMAGE /tmp/verify-matchup-container.mjs --app-root /app
```

Capture source commit, release lock, manifest hash, archive hash, candidate image ID/digest, and lookup receipt. Upload/build/merge/deploy/live-delivery are separate states. Review the execution receipts before promotion. Use the existing supported release/Atlas process; do not start another bot or send public test messages. After authorized deployment, inspect the actual image, manifest/release ID, startup/health and lookup diagnostics; require all 1,862 installed lookups. Observe the next naturally occurring game-chat attachment before claiming live delivery.

## Rollback

Before promotion, preserve the previous application image digest and its matching asset archive. Keep the legacy R2 object intact and an immutable backup identity for its exact bytes. Restore the complete previous application image carrying its matching assets on wrong-team output, unsupported lookup failures, invalid manifest, or channel regression. Do not combine old code with a new asset format.

Verify the restored container's image digest, health and asset hashes against the preserved baseline. Rehearse rollback with an inert container before promotion: inspect its asset inventory/hash list without logging into Discord; compare every file with the baseline audit. Keep the rollback receipt and failure evidence. Production rollback changes require the normal release operator and authorization.
