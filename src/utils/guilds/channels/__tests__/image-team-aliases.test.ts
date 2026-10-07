import { describe, expect, it } from 'vitest'
import {
	normalizeTeamName,
	pairKey,
	resolveTeam,
	TEAM_REGISTRY,
} from '../image-team-aliases.js'

describe('canonical image identities', () => {
	it('defines all 30 NBA and 32 NFL identities', () => {
		expect(TEAM_REGISTRY.nba).toHaveLength(30)
		expect(TEAM_REGISTRY.nfl).toHaveLength(32)
		for (const sport of ['nba', 'nfl'] as const)
			for (const team of TEAM_REGISTRY[sport]) {
				for (const alias of [team.id, team.name, ...team.aliases]) {
					expect(resolveTeam(sport, alias)).toBe(team.id)
					expect(
						resolveTeam(sport, `  ${alias.toUpperCase()}  `),
					).toBe(team.id)
				}
			}
	})
	it('handles explicit Portland and Washington aliases', () => {
		for (const alias of [
			'Portland Trail Blazers',
			'Trail Blazers',
			'TrailBlazers',
			'Blazers',
		])
			expect(resolveTeam('nba', alias)).toBe('blazers')
		for (const alias of [
			'Washington Commanders',
			'Commanders',
			'Washington Redskins',
			'Redskins',
			'Washington Football Team',
		])
			expect(resolveTeam('nfl', alias)).toBe('commanders')
		expect(normalizeTeamName(' Portland\u00a0Trail  Blazers ')).toBe(
			'portland trail blazers',
		)
	})
	it('never guesses from substrings or another sport', () => {
		for (const alias of [
			'Florida Panthers',
			'Winnipeg Jets',
			'Telugu Titans',
			'Jaipur Pink Panthers',
			'patriots-at-bears',
			'not patriots',
		])
			expect(resolveTeam('nfl', alias)).toBeNull()
		expect(resolveTeam('nba', 'New York Giants')).toBeNull()
		expect(resolveTeam('nfl', 'Atlanta Hawks')).toBeNull()
		expect(resolveTeam('nhl', 'Jets')).toBeNull()
	})
	it('keys both orders identically and rejects invalid identities', () => {
		expect(pairKey('nfl', 'patriots', 'bears')).toBe('nfl:bears:patriots')
		expect(pairKey('nfl', 'bears', 'patriots')).toBe('nfl:bears:patriots')
		expect(() => pairKey('nfl', 'bears', 'bears')).toThrow('self_matchup')
		expect(() => pairKey('nfl', 'hawks', 'bears')).toThrow('unknown_team')
		const keys = new Set<string>()
		for (const sport of ['nba', 'nfl'] as const)
			for (const a of TEAM_REGISTRY[sport])
				for (const b of TEAM_REGISTRY[sport])
					if (a.id !== b.id) keys.add(pairKey(sport, a.id, b.id))
		expect(keys.size).toBe(931)
	})
})
