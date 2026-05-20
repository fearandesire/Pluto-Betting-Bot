import type { PropDto } from '@pluto-khronos/api-client'
import type { CachedProp } from '../props/PropCacheService.js'

const EXCLUDED_MARKETS = [
	'h2h',
	'spreads',
	'totals',
	'team_totals',
	'player_anytime_td',
]

/**
 * Convert PropDto array (with outcomes) to CachedProp format.
 */
export function convertFlatPropsToCachedProps(props: PropDto[]): CachedProp[] {
	const cached: CachedProp[] = []

	for (const prop of props) {
		if (EXCLUDED_MARKETS.includes(prop.market_key)) {
			continue
		}

		if (!prop.outcomes || !prop.event_context) {
			continue
		}

		for (const outcome of prop.outcomes) {
			cached.push({
				outcome_uuid: outcome.outcome_uuid,
				market_id: prop.market_id ?? null,
				description: outcome.description || 'Unknown',
				market_key: prop.market_key,
				point: outcome.point || null,
				home_team: prop.event_context.home_team,
				away_team: prop.event_context.away_team,
				commence_time: prop.event_context.commence_time,
			})
		}
	}

	return cached
}
