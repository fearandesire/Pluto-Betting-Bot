import type { PropDto } from '@pluto-khronos/api-client'
import { describe, expect, it, vi } from 'vitest'
import {
	EMPTY_PROP_PICKER_FILTERS,
	paginatePropPickerPairs,
} from '../PropPicker.js'
import { PropPickerService } from '../PropPickerService.js'

function makeProp(index: number, overrides: Partial<PropDto> = {}): PropDto {
	return {
		event_id: `event-${index % 2}`,
		event_context: {
			home_team: `Home ${index % 2}`,
			away_team: `Away ${index % 2}`,
			commence_time: new Date(
				Date.UTC(2026, 6, 11, 18, index),
			).toISOString(),
			sport_title: 'NBA',
		},
		market_key: index % 2 === 0 ? 'player_points' : 'player_rebounds',
		bookmaker_key: 'draftkings',
		outcomes: [
			{
				outcome_uuid: `over-${index}`,
				name: 'Over',
				description: `Player ${index + 1}`,
				price: -110,
				point: 10.5 + index,
			},
			{
				outcome_uuid: `under-${index}`,
				name: 'Under',
				description: `Player ${index + 1}`,
				price: 100,
				point: 10.5 + index,
			},
		],
		...overrides,
	} as PropDto
}

function makeApi(props: PropDto[]) {
	const byUuid = new Map(
		props.flatMap((prop) =>
			prop.outcomes.map((outcome) => [outcome.outcome_uuid, prop]),
		),
	)
	return {
		getAvailableProps: vi.fn(async () => props),
		getPropByUuid: vi.fn(async (uuid: string) => {
			const prop = byUuid.get(uuid)
			if (!prop) throw new Error('missing outcome')
			return prop
		}),
		postSelectedProps: vi.fn(async () => ({
			posted: 6,
			skipped: 0,
			failed: 0,
			refused: [],
			ledger_entries: [],
		})),
	}
}

describe('PropPickerService', () => {
	it('pairs, filters and pages the available slate', async () => {
		const props = Array.from({ length: 30 }, (_, index) => makeProp(index))
		const service = new PropPickerService(makeApi(props))

		const session = await service.start({
			token: 'a'.repeat(16),
			userId: 'admin-1',
			guildId: 'guild-1',
			sport: 'nba',
			filters: { player: 'Player 1' },
		})

		expect(session.pairs.length).toBeGreaterThan(0)
		expect(
			session.pairs.every((pair) =>
				(pair.player ?? '').includes('Player 1'),
			),
		).toBe(true)
		expect(paginatePropPickerPairs(session.pairs, 0).items.length).toBe(
			Math.min(25, session.pairs.length),
		)
	})

	it('keeps six picks across pages and posts the Over UUIDs', async () => {
		const props = Array.from({ length: 30 }, (_, index) => makeProp(index))
		const api = makeApi(props)
		const service = new PropPickerService(api)
		const session = await service.start({
			token: 'b'.repeat(16),
			userId: 'admin-1',
			guildId: 'guild-1',
			sport: 'nba',
		})
		const firstPage = paginatePropPickerPairs(session.pairs, 0)
		const secondPage = paginatePropPickerPairs(session.pairs, 1)
		session.selected = [
			...firstPage.items.slice(0, 3).map((pair) => pair.key),
			...secondPage.items.slice(0, 3).map((pair) => pair.key),
		]

		const recheck = await service.recheck(session)
		expect(recheck.changes).toHaveLength(0)
		expect(recheck.missing).toHaveLength(0)
		const result = await service.post({
			...session,
			prices: recheck.prices,
		})

		expect(result.posted).toBe(6)
		expect(api.postSelectedProps).toHaveBeenCalledWith({
			sport: 'nba',
			outcomeUuids: [
				...firstPage.items.slice(0, 3).map((pair) => pair.overUuid),
				...secondPage.items.slice(0, 3).map((pair) => pair.overUuid),
			],
			guildIds: ['guild-1'],
		})
	})

	it('reports a moved price against the displayed baseline and then accepts it', async () => {
		const props = [makeProp(0)]
		const api = makeApi(props)
		const service = new PropPickerService(api)
		const session = await service.start({
			token: 'c'.repeat(16),
			userId: 'admin-1',
			guildId: 'guild-1',
			sport: 'nba',
			filters: EMPTY_PROP_PICKER_FILTERS,
		})
		session.selected = [session.pairs[0]!.key]
		const moved = makeProp(0)
		moved.outcomes = [
			{
				outcome_uuid: 'over-0',
				name: 'Over',
				description: 'Player 1',
				price: -125,
				point: 10.5,
			},
			{
				outcome_uuid: 'under-0',
				name: 'Under',
				description: 'Player 1',
				price: 105,
				point: 10.5,
			},
		]
		api.getPropByUuid.mockResolvedValue(moved)

		const first = await service.recheck(session)
		expect(first.changes).toHaveLength(1)
		expect(first.changes[0]?.after).toEqual({ over: -125, under: 105 })

		const second = await service.recheck({
			...session,
			prices: first.prices,
		})
		expect(second.changes).toHaveLength(0)
	})

	it('drops a pair whose quote disappeared', async () => {
		const api = makeApi([makeProp(0)])
		const service = new PropPickerService(api)
		const session = await service.start({
			token: 'd'.repeat(16),
			userId: 'admin-1',
			guildId: 'guild-1',
			sport: 'nba',
		})
		session.selected = [session.pairs[0]!.key]
		api.getPropByUuid.mockRejectedValue(new Error('gone'))

		const recheck = await service.recheck(session)
		expect(recheck.missing).toHaveLength(1)
		expect(recheck.changes).toHaveLength(1)
	})
})
