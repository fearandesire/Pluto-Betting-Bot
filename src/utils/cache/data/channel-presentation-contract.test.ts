import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as contracts from './channel-presentation-contract.js'

const core = {
	id: '00000000-0000-4000-8000-000000000001',
	sport: 'nba',
	created: false,
	channelname: 'celtics-at-pistons',
	home_team: 'Detroit Pistons',
	away_team: 'Boston Celtics',
	gametime: '2099-10-20T23:00:00Z',
	status: 'scheduled',
	betting: { state: 'unavailable', reason: 'no_markets' },
}
const available = {
	state: 'available',
	matchOdds: {
		favored: 'Boston Celtics',
		home_team_odds: 150,
		away_team_odds: -175,
	},
}
const cases = [
	{
		...core,
		schedule_provider: 'espn',
		schedule_observed_at: '2026-10-20T22:00:00Z',
		schedule_snapshot_ref: 'fixture-snapshot',
	},
	{ ...core },
	{ ...core, betting: available },
	{
		...core,
		betting: {
			...available,
			matchOdds: { ...available.matchOdds, home_team_odds: 0 },
		},
	},
	{
		...core,
		betting: {
			...available,
			matchOdds: { ...available.matchOdds, favored: 'Chicago Bulls' },
		},
	},
	{
		...core,
		betting: {
			state: 'unavailable',
			reason: 'no_markets',
			matchOdds: available.matchOdds,
		},
	},
	{ ...core, status: 'unknown' },
	{ ...core, home_team: core.away_team },
	{ ...core, id: 'ESPN-numeric-id' },
]
describe('additive channel contracts', () => {
	it('accepts independent schedules and rejects invalid identities and market state', () => {
		expect(
			cases.map(
				(item) =>
					contracts.channelAggregatedV2Schema.safeParse(item).success,
			),
		).toEqual([true, true, true, false, false, false, false, false, false])
	})
	it.skipIf(!process.env.PLUTO_SHARED_CONTRACT_MODULE)(
		'matches the producer shared-package build for the full fixture corpus',
		async () => {
			const shared = await import(
				/* @vite-ignore */ pathToFileURL(
					process.env.PLUTO_SHARED_CONTRACT_MODULE!,
				).href
			)
			for (const item of cases) {
				const producer =
					shared.channelAggregatedV2Schema.safeParse(item)
				const consumer =
					contracts.channelAggregatedV2Schema.safeParse(item)
				expect(consumer.success).toBe(producer.success)
				if (consumer.success)
					expect(JSON.parse(JSON.stringify(consumer.data))).toEqual(
						JSON.parse(JSON.stringify(producer.data)),
					)
			}
		},
	)
})
