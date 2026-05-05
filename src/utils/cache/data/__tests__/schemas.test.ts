import { describe, expect, it } from 'vitest'
import { teamRecordsResultSchema } from '../schemas.js'

describe('teamRecordsResultSchema', () => {
	it('accepts the minimal legacy shape (backward compat)', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: '48-24' },
			away_team: { total_record: '42-30' },
		})
		expect(result.success).toBe(true)
	})

	it('accepts null total_record', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: null },
			away_team: { total_record: null },
		})
		expect(result.success).toBe(true)
	})

	it('accepts the full regular-season shape with all optional fields', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: {
				display_name: 'Boston Celtics',
				abbreviation: 'BOS',
				total_record: '48-24',
				home_record: '26-11',
				away_record: '22-13',
				playoff_record: null,
			},
			away_team: {
				display_name: 'Los Angeles Lakers',
				abbreviation: 'LAL',
				total_record: '42-30',
				home_record: '22-15',
				away_record: '20-15',
				playoff_record: null,
			},
		})
		expect(result.success).toBe(true)
	})

	it('accepts a payload with a series object (playoffs)', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: '48-24', playoff_record: '4-3' },
			away_team: { total_record: '42-30', playoff_record: '3-4' },
			series: {
				round: 'Conference Finals',
				summary: 'BOS leads series 3-2',
				home_wins: 3,
				away_wins: 2,
				total_games: 7,
				completed: false,
			},
		})
		expect(result.success).toBe(true)
	})

	it('accepts a payload with series: null', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: '48-24' },
			away_team: { total_record: '42-30' },
			series: null,
		})
		expect(result.success).toBe(true)
	})

	it('rejects a payload missing away_team entirely', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: '48-24' },
		})
		expect(result.success).toBe(false)
	})

	it('rejects total_record of wrong type (number instead of string)', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: 48 },
			away_team: { total_record: '42-30' },
		})
		expect(result.success).toBe(false)
	})

	it('rejects a series with wrong-typed fields', () => {
		const result = teamRecordsResultSchema.safeParse({
			home_team: { total_record: '48-24' },
			away_team: { total_record: '42-30' },
			series: { home_wins: 'three', completed: 'yes' },
		})
		expect(result.success).toBe(false)
	})
})
