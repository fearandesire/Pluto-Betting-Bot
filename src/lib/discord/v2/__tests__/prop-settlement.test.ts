import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { describe, expect, it } from 'vitest'
import { propBoardPayload } from '../../builders/prop-board.js'
import {
	disableSettledPropRow,
	settleV2BoardComponents,
	toComponentJsonList,
} from '../prop-settlement.js'

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

const settlement = {
	outcome_uuid: 'over-2',
	result: 'won' as const,
	winning_side_display: 'Over',
	actual_value: 2,
	market_key: 'player_pass_tds',
	description: 'Josh Allen',
	point: 1.5,
	tallies: { correct: 14, incorrect: 9, total: 23 },
	messages: [
		{
			guild_id: 'guild-1',
			channel_id: 'channel-1',
			message_id: 'message-1',
		},
	],
}

function boardComponents() {
	return toComponentJsonList(
		propBoardPayload({
			props: [prop, second],
			sport: 'nfl',
			teams,
		}).components,
	)
}

type Row = {
	type: number
	content?: string
	components?: Array<{
		custom_id?: string
		disabled?: boolean
	}>
}

function containerRows(components: ReturnType<typeof boardComponents>) {
	const container = components[0] as { components: Row[] }
	return container.components
}

describe('settleV2BoardComponents', () => {
	it('updates only the graded row and disables only its buttons', () => {
		const original = boardComponents()
		const { components, touched } = settleV2BoardComponents(
			original,
			settlement,
		)
		expect(touched).toBe(true)
		const rows = containerRows(components)
		const firstRow = rows[3]
		const secondRow = rows[5]
		expect(firstRow.components?.map((b) => b.disabled)).toEqual([
			undefined,
			undefined,
		])
		expect(secondRow.components?.map((b) => b.disabled)).toEqual([
			true,
			true,
		])
		expect(rows[2].content).not.toContain('Result:')
		expect(rows[4].content).toContain('Josh Allen')
		expect(rows[4].content).toContain('**Result: Over ✅ — 2**')
		expect(rows[4].content).toContain(
			'-# 📊 61% of 23 predictors got it right.',
		)
		// The heading and footer are untouched.
		expect(rows[0].content).toBe('## 🎯 Accuracy Challenge')
		expect(rows[6].content).toContain('Each prop grades in place')
	})

	it('replaces an earlier result instead of appending a second one', () => {
		const first = settleV2BoardComponents(boardComponents(), settlement)
		const retry = settleV2BoardComponents(first.components, settlement)
		const text = (containerRows(retry.components)[4].content ?? '').split(
			'\n',
		)
		expect(text.filter((line) => line.includes('**Result:'))).toHaveLength(
			1,
		)
		expect(text.filter((line) => line.startsWith('-# 📊'))).toHaveLength(1)
	})

	it('leaves a board unchanged when the outcome is not on it', () => {
		const before = JSON.stringify(boardComponents())
		const result = settleV2BoardComponents(boardComponents(), {
			...settlement,
			outcome_uuid: 'missing-outcome',
		})
		expect(result.touched).toBe(false)
		expect(JSON.stringify(result.components)).toBe(before)
	})
})

describe('disableSettledPropRow', () => {
	it('disables one legacy action row and keeps the other', () => {
		const rows: Array<{
			type: number
			components: Array<{
				type: number
				custom_id: string
				disabled?: boolean
			}>
		}> = [
			{
				type: 1,
				components: [
					{ type: 2, custom_id: 'prop_over-1' },
					{ type: 2, custom_id: 'prop_under-1' },
				],
			},
			{
				type: 1,
				components: [
					{ type: 2, custom_id: 'prop_over-2' },
					{ type: 2, custom_id: 'prop_under-2' },
				],
			},
		]
		const result = disableSettledPropRow(rows, 'under-2')
		expect(result.touched).toBe(true)
		expect(result.components[0].components?.map((b) => b.disabled)).toEqual(
			[undefined, undefined],
		)
		expect(result.components[1].components?.map((b) => b.disabled)).toEqual(
			[true, true],
		)
		// The input is not mutated.
		expect(rows[1].components[0].disabled).toBeUndefined()
	})
})
