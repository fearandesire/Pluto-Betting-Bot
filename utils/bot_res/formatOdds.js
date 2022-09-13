/**
 * Format + onto odds provided as 'negative' odds by default have the `-` character
 * @param {string | integer} homeOdds - Odds of the Home Team
 * @param {string | integer} awayOdds - Odds of the Away Team
 * @return {string} Returns the replaced string of odds
 */
export async function formatOdds(homeOdds, awayOdds) {
	console.log(`homeOdds: ${homeOdds} | awayOdds: ${awayOdds}`)
	homeOdds = homeOdds.toString()
	awayOdds = awayOdds.toString()
	if (homeOdds.includes('-')) {
		awayOdds = `+${awayOdds}`
	}
	if (awayOdds.includes('-')) {
		homeOdds = `+${homeOdds}`
	}
	return {
		homeOdds: homeOdds,
		awayOdds: awayOdds,
	}
}
