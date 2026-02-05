import type { MatchDetailDto } from '@kh-openapi'
import { describe, expect, it } from 'vitest'
import { getTeamChoicesForMatch } from './autocomplete-choices.js'

describe('getTeamChoicesForMatch', () => {
	const matches: MatchDetailDto[] = [
		{
			id: 'match-1',
			home_team: 'Lakers',
			away_team: 'Celtics',
			commence_time: '2025-02-05T00:00:00Z',
			sport: 'basketball_nba',
		},
		{
			id: 'match-2',
			home_team: 'Chiefs',
			away_team: 'Bills',
			commence_time: '2025-02-06T00:00:00Z',
			sport: 'americanfootball_nfl',
		},
	]

	it('returns empty array when no match is selected', () => {
		expect(getTeamChoicesForMatch(matches, null)).toEqual([])
		expect(getTeamChoicesForMatch(matches, '')).toEqual([])
	})

	it('returns empty array when selected match id is not in the list', () => {
		expect(getTeamChoicesForMatch(matches, 'other-id')).toEqual([])
	})

	it('returns only home and away team of the selected match', () => {
		const choices = getTeamChoicesForMatch(matches, 'match-1')
		expect(choices).toHaveLength(2)
		expect(choices.map((c) => c.value).sort()).toEqual([
			'Celtics',
			'Lakers',
		])
		expect(choices.every((c) => c.name === c.value)).toBe(true)
	})

	it('trims team names', () => {
		const withSpaces: MatchDetailDto[] = [
			{
				id: 'm',
				home_team: '  Home  ',
				away_team: ' Away ',
				commence_time: '2025-02-05T00:00:00Z',
				sport: 'nba',
			},
		]
		const choices = getTeamChoicesForMatch(withSpaces, 'm')
		expect(choices).toEqual([
			{ name: 'Home', value: 'Home' },
			{ name: 'Away', value: 'Away' },
		])
	})
})
