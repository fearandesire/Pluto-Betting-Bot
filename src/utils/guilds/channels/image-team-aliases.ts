import { TEAM_REGISTRY, TEAMS_REVISION } from './image-team-data.js'

export { TEAM_REGISTRY, TEAMS_REVISION }
export type ImageSport = 'nba' | 'nfl'
export function normalizeTeamName(name: string): string {
	return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}
const aliases: Record<ImageSport, Map<string, string>> = {
	nba: new Map(),
	nfl: new Map(),
}
for (const sport of ['nba', 'nfl'] as const) {
	for (const team of TEAM_REGISTRY[sport]) {
		for (const name of [team.id, team.name, ...team.aliases]) {
			const normalized = normalizeTeamName(name)
			const prior = aliases[sport].get(normalized)
			if (prior && prior !== team.id)
				throw new Error(`alias_collision:${sport}:${normalized}`)
			aliases[sport].set(normalized, team.id)
		}
	}
}
export function resolveTeam(sport: string, name: string): string | null {
	if (!(sport === 'nba' || sport === 'nfl') || typeof name !== 'string')
		return null
	return aliases[sport].get(normalizeTeamName(name)) ?? null
}
export function pairKey(sport: ImageSport, a: string, b: string): string {
	if (
		!TEAM_REGISTRY[sport]?.some((t) => t.id === a) ||
		!TEAM_REGISTRY[sport]?.some((t) => t.id === b)
	)
		throw new Error('unknown_team')
	if (a === b) throw new Error('self_matchup')
	return `${sport}:${[a, b].sort().join(':')}`
}
