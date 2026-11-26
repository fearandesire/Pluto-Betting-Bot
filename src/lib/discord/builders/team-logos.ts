/**
 * ESPN's CDN names most team logos by the lowercase abbreviation resolve-team
 * returns. These are the ones it spells differently.
 */
const ESPN_ABBREVIATIONS: Record<'nba' | 'nfl', Record<string, string>> = {
	nba: {
		GSW: 'gs',
		NOP: 'no',
		NYK: 'ny',
		SAS: 'sa',
		UTA: 'utah',
		WAS: 'wsh',
	},
	nfl: {
		WAS: 'wsh',
	},
}

/** The 500px ESPN logo for a resolve-team abbreviation, or null without one. */
export function espnTeamLogoUrl(
	sport: 'nba' | 'nfl',
	abbrev: string | readonly string[] | undefined,
): string | null {
	const code = (Array.isArray(abbrev) ? abbrev[0] : abbrev)
		?.trim()
		.toUpperCase()
	if (!code || !/^[A-Z]{2,4}$/.test(code)) return null
	const espn = ESPN_ABBREVIATIONS[sport][code] ?? code.toLowerCase()
	return `https://a.espncdn.com/i/teamlogos/${sport}/500/${espn}.png`
}
