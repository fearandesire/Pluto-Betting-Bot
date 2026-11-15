import type { PropDto } from '@pluto-khronos/api-client'
import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
	buildPropPickerPairs,
	EMPTY_PROP_PICKER_FILTERS,
	initialPropPickerPrices,
} from '../../../../utils/props/PropPicker.js'
import type { PropPickerSession } from '../../../../utils/props/PropPickerStore.js'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import {
	decodePropPickerId,
	encodePropPickerId,
	propPickerNotice,
	propPickerPayload,
	propPickerPostedPayload,
	propPickerPreviewPayload,
} from '../prop-picker.js'

const TOKEN = '0123456789abcdef'

function makeProp(index: number): PropDto {
	return {
		event_id: `event-${index % 2}`,
		event_context: {
			home_team: `Home ${index % 2}`,
			away_team: `Away ${index % 2}`,
			commence_time: '2026-07-11T18:00:00Z',
			sport_title: 'NBA',
		},
		market_key: 'player_points',
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
	} as PropDto
}

function makeSession(count = 3): PropPickerSession {
	const pairs = buildPropPickerPairs(
		Array.from({ length: count }, (_, index) => makeProp(index)),
	)
	return {
		token: TOKEN,
		userId: 'admin-1',
		guildId: 'guild-1',
		sport: 'nba',
		filters: EMPTY_PROP_PICKER_FILTERS,
		page: 0,
		selected: [],
		pairs,
		prices: initialPropPickerPrices(pairs),
	}
}

describe('prop picker custom IDs', () => {
	it('round-trips each action and rejects anything else', () => {
		for (const action of [
			'select',
			'prev',
			'next',
			'clear',
			'preview',
			'post',
		] as const) {
			expect(
				decodePropPickerId(encodePropPickerId(TOKEN, action)),
			).toEqual({ action, token: TOKEN })
		}
		expect(decodePropPickerId('props.pick.v1.post.nope')).toBeNull()
		expect(decodePropPickerId('props.pick.v1.else.post')).toBeNull()
	})
})

describe('propPickerPayload', () => {
	it('renders one page with a 25-option select and five controls', () => {
		const payload = propPickerPayload(makeSession(30))

		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 13,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{
				components?: Array<{
					options?: Array<{ default?: boolean }>
					custom_id?: string
				}>
			}>
		}>
		const rows = container.components.filter(
			(component) => component.components,
		)
		expect(rows).toHaveLength(2)
		const select = rows[0]?.components?.[0]
		expect(select?.options).toHaveLength(25)
		const buttons = rows[1]?.components ?? []
		expect(buttons.map((button) => button.custom_id)).toEqual([
			`props.pick.v1.prev.${TOKEN}`,
			`props.pick.v1.next.${TOKEN}`,
			`props.pick.v1.clear.${TOKEN}`,
			`props.pick.v1.preview.${TOKEN}`,
			`props.pick.v1.post.${TOKEN}`,
		])
	})

	it('marks selections from another page and keeps the warning', () => {
		const session = makeSession(30)
		session.selected = [session.pairs[0]!.key]
		const payload = propPickerPayload(session, 'Prices moved.')
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 14,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{
				content?: string
				components?: Array<{
					options?: Array<{ default?: boolean }>
				}>
			}>
		}>
		expect(
			container.components.some((block) =>
				block.content?.includes('Prices moved.'),
			),
		).toBe(true)
		const options = container.components.find((block) => block.components)
			?.components?.[0]?.options
		expect(options?.[0]?.default).toBe(true)
	})

	it('drops the select when the page has no props', () => {
		const session = makeSession(0)
		expectV2Payload(propPickerPayload(session), {
			flags: MessageFlags.IsComponentsV2,
			components: 11,
		})
	})
})

describe('preview and notices', () => {
	it('lists selected pairs privately', () => {
		const session = makeSession(2)
		session.selected = session.pairs.map((pair) => pair.key)
		expectV2Payload(propPickerPreviewPayload(session), {
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			components: 4,
		})
	})

	it('reports the posted counts', () => {
		expectV2Payload(
			propPickerPostedPayload({
				posted: 6,
				skipped: 1,
				failed: 0,
				refused: [],
				ledger_entries: [],
			}),
			{
				flags: MessageFlags.IsComponentsV2,
				components: 4,
			},
		)
	})

	it('sends an ephemeral notice', () => {
		expectV2Payload(propPickerNotice('Expired.'), {
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			components: 2,
		})
	})
})
