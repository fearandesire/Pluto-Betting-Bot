// ============================================================================
// Prop Conversion - Pure transforms from Khronos PropDto to CachedProp
// ============================================================================

import type { PropDto } from '@pluto-khronos/api-client'
import type { CachedProp } from './PropCacheService.js'

/**
 * Market keys that are NOT player props and are excluded from the prop cache.
 *
 * Exported so every layer (cron, filtering, presentation) shares one exclusion
 * contract instead of redefining the list locally.
 */
export const EXCLUDED_PROP_MARKETS: readonly string[] = [
	'h2h',
	'spreads',
	'totals',
	'team_totals',
	'player_anytime_td',
]

/**
 * Flatten Khronos `PropDto[]` into individual `CachedProp` outcomes.
 *
 * Pure function — no Discord, cache, or logging dependencies — so it is unit
 * testable in isolation.
 *
 * Behaviour:
 * - Skips non-player markets (see {@link EXCLUDED_PROP_MARKETS}).
 * - Skips props missing `outcomes` or `event_context`.
 * - Populates `market_id` from the source prop. `market_id` groups the
 *   Over/Under outcomes of a prop into a pair, which is what
 *   `PropsCacheService.getActiveProps` deduplicates on; it is `null` only when
 *   the source prop has no `market_id` (legacy data). Previously this field was
 *   omitted here, so cron-sourced outcomes were written to the prop cache with
 *   a shape that violates `CachedPropSchema` and cannot be deduplicated by
 *   `market_id` (see GitHub #491).
 */
export function convertFlatPropsToCachedProps(props: PropDto[]): CachedProp[] {
	const cached: CachedProp[] = []

	for (const prop of props) {
		// Skip non-player props
		if (EXCLUDED_PROP_MARKETS.includes(prop.market_key)) {
			continue
		}

		// Skip if missing required nested fields
		if (!prop.outcomes || !prop.event_context) {
			continue
		}

		// Flatten each outcome into a separate cached outcome
		for (const outcome of prop.outcomes) {
			cached.push({
				outcome_uuid: outcome.outcome_uuid,
				// Source market_id from the prop so Over/Under outcomes of the
				// same prop share it and dedup-by-market_id works.
				market_id: prop.market_id ?? null,
				description: outcome.description || 'Unknown',
				market_key: prop.market_key,
				// ?? (not ||) so a legitimate line of 0 is preserved, not
				// coerced to null (CachedPropSchema distinguishes 0 from null).
				point: outcome.point ?? null,
				home_team: prop.event_context.home_team,
				away_team: prop.event_context.away_team,
				commence_time: prop.event_context.commence_time,
			})
		}
	}

	return cached
}
