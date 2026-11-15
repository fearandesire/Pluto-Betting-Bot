import type { PropDto } from '@pluto-khronos/api-client'
import { describe, expect, it } from 'vitest'
import {
	buildPropPickerPairs,
	diffPropPickerPrices,
	EMPTY_PROP_PICKER_FILTERS,
	filterPropPickerPairs,
	initialPropPickerPrices,
	paginatePropPickerPairs,
	selectedPropPickerPairs,
	togglePropPickerSelection,
} from '../PropPicker.js'

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

describe('buildPropPickerPairs', () => {
	it('pairs one over and under side and dedupes a repeated market', () => {
		const prop = makeProp(0)
		const repeat = {
			...prop,
			market_id: 2,
			outcomes: prop.outcomes.map((outcome) => ({
				...outcome,
				outcome_uuid: `repeat-${outcome.outcome_uuid}`,
			})),
		} as PropDto

		const pairs = buildPropPickerPairs([prop, repeat])

		expect(pairs).toHaveLength(1)
		expect(pairs[0]).toMatchObject({
			player: 'Player 1',
			marketKey: 'player_points',
			line: 10.5,
			overUuid: 'over-0',
			underUuid: 'under-0',
		})
	})

	it('pairs a side without a player name with its partner line', () => {
		const prop = makeProp(0)
		prop.outcomes[1] = { ...prop.outcomes[1]!, description: null }

		expect(buildPropPickerPairs([prop])).toHaveLength(1)
	})

	it('leaves an unpaired alt line out', () => {
		const prop = makeProp(0)
		prop.outcomes.push({
			outcome_uuid: 'alt-over',
			name: 'Over',
			description: 'Player 1',
			price: 150,
			point: 30.5,
		})

		expect(buildPropPickerPairs([prop])).toHaveLength(1)
	})
})

describe('filterPropPickerPairs', () => {
	const pairs = buildPropPickerPairs([makeProp(0), makeProp(1), makeProp(2)])

	it('filters by team, category and player together', () => {
		const filtered = filterPropPickerPairs(pairs, {
			...EMPTY_PROP_PICKER_FILTERS,
			game: 'home 0',
			category: 'points',
			player: 'player 1',
		})

		expect(filtered).toHaveLength(1)
		expect(filtered[0]?.marketKey).toBe('player_points')
	})
})

describe('paging and selection', () => {
	const pairs = buildPropPickerPairs(
		Array.from({ length: 30 }, (_, index) => makeProp(index)),
	)

	it('pages 25 at a time and clamps a stale page', () => {
		expect(paginatePropPickerPairs(pairs, 0).items).toHaveLength(25)
		expect(paginatePropPickerPairs(pairs, 1).items).toHaveLength(5)
		expect(paginatePropPickerPairs(pairs, 9).page).toBe(1)
	})

	it('keeps selections by key and resolves the selected pairs', () => {
		const first = paginatePropPickerPairs(pairs, 0).items[0]!
		const secondPage = paginatePropPickerPairs(pairs, 1).items
		const last = secondPage[secondPage.length - 1]!
		let selected = togglePropPickerSelection([], first.key)
		selected = togglePropPickerSelection(selected, last.key)

		expect(
			selectedPropPickerPairs(pairs, selected).map((pair) => pair.key),
		).toEqual([first.key, last.key])
		expect(togglePropPickerSelection(selected, first.key)).toEqual([
			last.key,
		])
	})
})

describe('price checks', () => {
	const pairs = buildPropPickerPairs([makeProp(0)])
	const pair = pairs[0]!

	it('uses the displayed baseline and flags a missing quote', () => {
		const prices = initialPropPickerPrices(pairs)
		const current = new Map([[pair.key, { over: -125, under: 105 }]])

		expect(diffPropPickerPrices(pairs, current, prices)).toHaveLength(1)
		expect(
			diffPropPickerPrices(pairs, current, {
				...prices,
				[pair.key]: { over: -125, under: 105 },
			}),
		).toHaveLength(0)
		expect(diffPropPickerPrices(pairs, new Map(), prices)).toHaveLength(1)
	})
})
