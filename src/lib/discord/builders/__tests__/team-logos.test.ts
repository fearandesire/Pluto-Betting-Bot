import { describe, expect, it } from 'vitest'
import { espnTeamLogoUrl } from '../team-logos.js'

const logo = (sport: 'nba' | 'nfl', code: string) =>
	`https://a.espncdn.com/i/teamlogos/${sport}/500/${code}.png`

describe('espnTeamLogoUrl', () => {
	it.each([
		['GSW', 'gs'],
		['NOP', 'no'],
		['NYK', 'ny'],
		['SAS', 'sa'],
		['UTA', 'utah'],
		['WAS', 'wsh'],
		['MIN', 'min'],
		['OKC', 'okc'],
		['BKN', 'bkn'],
		['PHX', 'phx'],
	])('maps NBA %s to ESPN %s', (abbrev, espn) => {
		expect(espnTeamLogoUrl('nba', abbrev)).toBe(logo('nba', espn))
	})

	it.each([
		['WAS', 'wsh'],
		['NO', 'no'],
		['LAR', 'lar'],
		['JAX', 'jax'],
	])('maps NFL %s to ESPN %s', (abbrev, espn) => {
		expect(espnTeamLogoUrl('nfl', abbrev)).toBe(logo('nfl', espn))
	})

	it('reads the one-item array resolve-team returns', () => {
		expect(espnTeamLogoUrl('nba', ['GSW'])).toBe(logo('nba', 'gs'))
	})

	it('returns null for a missing or malformed abbreviation', () => {
		expect(espnTeamLogoUrl('nba', undefined)).toBeNull()
		expect(espnTeamLogoUrl('nba', [])).toBeNull()
		expect(espnTeamLogoUrl('nba', 'Golden State')).toBeNull()
	})
})
