import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import { propBoardPayload } from '../prop-board.js'

const prop = {
	commence_time: '2026-10-04T20:25:00Z',
	market_key: 'player_pass_yds',
	description: 'Patrick Mahomes',
	point: 274.5,
	over: { outcome_uuid: 'over-1', outcome_name: 'Over', price: -115 },
	under: { outcome_uuid: 'under-1', outcome_name: 'Under', price: 105 },
} as ProcessedPropDto

const second = {
	...prop,
	description: 'Josh Allen',
	market_key: 'player_pass_tds',
	point: 1.5,
	over: { outcome_uuid: 'over-2', outcome_name: 'Over', price: 120 },
	under: { outcome_uuid: 'under-2', outcome_name: 'Under', price: -140 },
} as ProcessedPropDto

const teams = { homeAbbrev: ['KC'], awayAbbrev: ['BUF'], homeColor: 0xe31837 }

describe('propBoardPayload', () => {
	it('renders one text block and its own choice row per pair, in order', () => {
		const payload = propBoardPayload({
			props: [prop, second],
			sport: 'nfl',
			teams,
		})
		// container + heading + matchup + 2×(text + row + 2 buttons) + footer
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 12,
		})
		expect(payload.allowedMentions).toEqual({ parse: [] })
		const [container] = toJsonComponents(payload) as Array<{
			accent_color?: number
			components: Array<{
				type: number
				content?: string
				components?: Array<{
					custom_id?: string
					label?: string
					disabled?: boolean
				}>
			}>
		}>
		expect(container.accent_color).toBe(0xe31837)
		expect(container.components.map((c) => c.type)).toEqual([
			10, 10, 10, 1, 10, 1, 10,
		])
		expect(container.components[0].content).toBe('## 🎯 Accuracy Challenge')
		expect(container.components[1].content).toContain('BUF vs. KC')
		expect(container.components[2].content).toContain('Patrick Mahomes')
		expect(container.components[4].content).toContain('Josh Allen')
		expect(
			container.components
				.filter((c) => c.type === 1)
				.map((row) =>
					row.components?.map((button) => button.custom_id),
				),
		).toEqual([
			['prop_over-1', 'prop_under-1'],
			['prop_over-2', 'prop_under-2'],
		])
		expect(container.components[6].content).toContain(
			'Each prop grades in place',
		)
	})

	it('caps a board at four pairs', () => {
		const many = Array.from({ length: 6 }, (_, i) => ({
			...prop,
			over: { ...prop.over, outcome_uuid: `over-${i}` },
			under: { ...prop.under, outcome_uuid: `under-${i}` },
		})) as ProcessedPropDto[]
		const payload = propBoardPayload({
			props: many,
			sport: 'nfl',
			teams,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{ type: number }>
		}>
		expect(container.components.filter((c) => c.type === 1)).toHaveLength(4)
	})

	it('falls back to a label instead of an invalid timestamp', () => {
		const payload = propBoardPayload({
			props: [{ ...prop, commence_time: 'not-a-date' }],
			sport: 'nfl',
			teams,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{ content?: string }>
		}>
		expect(container.components[1].content).toContain('Player props')
		expect(container.components[1].content).not.toContain('<t:')
	})
})
