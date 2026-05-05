import type { MatchDetailDto } from '@kh-openapi'

export function normalizeTeamName(teamName: string): string {
	return teamName.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Returns team autocomplete choices for a selected match.
 * Returns empty array when no match is selected or match is not in the list.
 */
export function getTeamChoicesForMatch(
	matches: MatchDetailDto[],
	matchId: string | null,
): { name: string; value: string }[] {
	if (!matchId) return []
	const match = matches.find((m) => m.id === matchId)
	if (!match?.home_team || !match?.away_team) return []
	return [match.home_team, match.away_team]
		.filter((team): team is string => typeof team === 'string')
		.map((team) => {
			const normalized = team.trim()
			return { name: normalized, value: normalized }
		})
}
