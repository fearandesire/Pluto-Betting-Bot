import type { PropDto } from '@pluto-khronos/api-client'
import { describe, expect, it } from 'vitest'
import { convertFlatPropsToCachedProps } from './props-conversion.js'

const eventContext = {
	home_team: 'Los Angeles Lakers',
	away_team: 'Boston Celtics',
	commence_time: '2026-06-01T20:00:00.000Z',
}

describe('convertFlatPropsToCachedProps', () => {
	it('copies market_id from the parent PropDto to each cached outcome', () => {
		const props = [
			{
				market_id: 12345,
				market_key: 'player_points',
				event_context: eventContext,
				outcomes: [
					{
						outcome_uuid: 'outcome-over',
						description: 'Player over points',
						point: 24.5,
					},
					{
						outcome_uuid: 'outcome-under',
						description: 'Player under points',
						point: 24.5,
					},
				],
			} as PropDto,
		]

		const cachedProps = convertFlatPropsToCachedProps(props)

		expect(cachedProps).toHaveLength(2)
		expect(cachedProps).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					outcome_uuid: 'outcome-over',
					market_id: 12345,
				}),
				expect.objectContaining({
					outcome_uuid: 'outcome-under',
					market_id: 12345,
				}),
			]),
		)
	})

	it.each([
		'h2h',
		'spreads',
		'totals',
		'team_totals',
		'player_anytime_td',
	])('excludes %s market props', (marketKey) => {
		const props = [
			{
				market_id: 12345,
				market_key: marketKey,
				event_context: eventContext,
				outcomes: [
					{
						outcome_uuid: `${marketKey}-outcome`,
						description: 'Excluded outcome',
						point: null,
					},
				],
			} as PropDto,
		]

		expect(convertFlatPropsToCachedProps(props)).toEqual([])
	})
})
