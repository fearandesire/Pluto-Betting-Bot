import type { PropDto } from '@pluto-khronos/api-client'
import { describe, expect, it } from 'vitest'
import {
	convertFlatPropsToCachedProps,
	EXCLUDED_PROP_MARKETS,
} from './prop-conversion.js'

/**
 * Builds a minimal valid PropDto for tests. `market_id` lives on the prop and
 * is shared by all of its outcomes (e.g. the Over/Under pair).
 */
function buildProp(overrides: Partial<PropDto> = {}): PropDto {
	return {
		event_id: 'evt-1',
		event_context: {
			home_team: 'Lakers',
			away_team: 'Warriors',
			commence_time: '2999-01-27T20:00:00Z',
			sport_title: 'NBA',
		},
		market_key: 'player_points',
		bookmaker_key: 'draftkings',
		market_id: 12345,
		outcomes: [
			{
				outcome_uuid: 'uuid-over',
				name: 'Over',
				description: 'LeBron James',
				price: 1.9,
				point: 25.5,
			},
			{
				outcome_uuid: 'uuid-under',
				name: 'Under',
				description: 'LeBron James',
				price: 1.9,
				point: 25.5,
			},
		],
		...overrides,
	}
}

describe('convertFlatPropsToCachedProps', () => {
	it('populates market_id on every outcome from the source prop (#491)', () => {
		const result = convertFlatPropsToCachedProps([buildProp()])

		expect(result).toHaveLength(2)
		expect(result.every((o) => o.market_id === 12345)).toBe(true)
		// market_id must always be present (the bug omitted it entirely)
		expect(result.every((o) => 'market_id' in o)).toBe(true)
	})

	it('sets market_id to null when the source prop has none (legacy data)', () => {
		const result = convertFlatPropsToCachedProps([
			buildProp({ market_id: undefined }),
		])

		expect(result).toHaveLength(2)
		expect(result.every((o) => o.market_id === null)).toBe(true)
	})

	it('preserves a point of 0 instead of coercing it to null', () => {
		const prop = buildProp()
		prop.outcomes[0].point = 0

		const [outcome] = convertFlatPropsToCachedProps([prop])
		expect(outcome.point).toBe(0)
	})

	it('keeps distinct market_ids so cron outcomes are groupable by prop', () => {
		const result = convertFlatPropsToCachedProps([
			buildProp({ market_id: 111 }),
			buildProp({ market_id: 222 }),
		])

		const uniqueMarketIds = new Set(result.map((o) => o.market_id))
		expect(uniqueMarketIds).toEqual(new Set([111, 222]))
	})

	it('excludes non-player markets', () => {
		const props: PropDto[] = EXCLUDED_PROP_MARKETS.map((market_key, i) =>
			buildProp({ market_key, market_id: i }),
		)
		// ...plus one valid player prop that must survive the filter
		props.push(buildProp({ market_key: 'player_assists', market_id: 999 }))

		const result = convertFlatPropsToCachedProps(props)

		expect(result).toHaveLength(2)
		expect(result.every((o) => o.market_key === 'player_assists')).toBe(
			true,
		)
		expect(result.every((o) => o.market_id === 999)).toBe(true)
	})

	it('skips props missing outcomes or event_context', () => {
		const noOutcomes: PropDto = { ...buildProp(), outcomes: undefined }
		const noContext: PropDto = { ...buildProp(), event_context: undefined }

		expect(convertFlatPropsToCachedProps([noOutcomes, noContext])).toEqual(
			[],
		)
	})

	it('produces outcomes whose shape matches the CachedProp contract', () => {
		const [outcome] = convertFlatPropsToCachedProps([buildProp()])

		expect(outcome).toEqual({
			outcome_uuid: 'uuid-over',
			market_id: 12345,
			description: 'LeBron James',
			market_key: 'player_points',
			point: 25.5,
			home_team: 'Lakers',
			away_team: 'Warriors',
			commence_time: '2999-01-27T20:00:00Z',
		})
	})
})
