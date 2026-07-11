import { describe, expect, it } from 'vitest'
import {
	buildWeeklyRecapEmbeds,
	formatRecapUser,
} from '../weekly-recap.embed.js'

const recap = {
	window: {
		start_date: '2026-07-06T00:00:00.000Z',
		end_date: '2026-07-12T23:59:59.999Z',
		week_number: 19,
		season_year: 2026,
	},
	total_predictions: 12,
	correct_predictions: 9,
	incorrect_predictions: 3,
	accuracy: 75,
	accuracy_delta: 12.5,
	top_predictors: [
		{
			user_id: '123456789012345678',
			correct_predictions: 8,
			incorrect_predictions: 1,
			success_rate: 88.888,
			display_name: 'Top predictor',
		},
	],
	biggest_single_win: {
		user_id: '123456789012345678',
		payout: 125.5,
	},
	biggest_parlay_win: null,
}

describe('buildWeeklyRecapEmbeds', () => {
	it('renders week metadata, predictor standings, highlights, and totals', () => {
		const [embed] = buildWeeklyRecapEmbeds(recap)
		const json = embed.toJSON()

		expect(json.title).toBe('📊 Week 19 Recap')
		expect(json.description).toContain('Jul 6')
		expect(json.fields?.map((field) => field.name)).toEqual([
			'Top predictors',
			'Highlights',
			'Totals',
		])
		expect(json.fields?.[0]?.value).toContain('Top predictor')
		expect(json.fields?.[1]?.value).toContain('125.50')
		expect(json.fields?.[2]?.value).toContain('75.0%')
	})

	it('renders a friendly quiet-week state', () => {
		const [embed] = buildWeeklyRecapEmbeds({
			...recap,
			total_predictions: 0,
			correct_predictions: 0,
			incorrect_predictions: 0,
			accuracy: 0,
			accuracy_delta: 0,
			top_predictors: [],
			biggest_single_win: null,
			biggest_parlay_win: null,
		})
		const json = embed.toJSON()

		expect(json.fields?.[0]?.value).toContain(
			'No predictors recorded this week',
		)
		expect(json.fields?.[1]?.value).toContain('No wins recorded this week')
	})
})

describe('formatRecapUser', () => {
	it('truncates long display names without dropping the identity fallback', () => {
		const formatted = formatRecapUser('123', 'a'.repeat(80))
		expect(formatted).toHaveLength(32)
		expect(formatted.endsWith('…')).toBe(true)
	})
})
